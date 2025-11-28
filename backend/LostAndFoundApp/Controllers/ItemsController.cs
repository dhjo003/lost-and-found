using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Dtos;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/items")]
    public class ItemsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<ItemsController> _logger;

        public ItemsController(AppDbContext db, ILogger<ItemsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetItems([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
            [FromQuery] int? statusId = null, [FromQuery] int? categoryId = null, [FromQuery] int? typeId = null,
            [FromQuery] string? q = null, [FromQuery] bool? hasPrimaryImage = null)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;

            IQueryable<Item> query = _db.Items
                .Include(i => i.Status)
                .Include(i => i.Category)
                .Include(i => i.Type)
                .Include(i => i.Images)
                .Include(i => i.User);

            if (statusId.HasValue) query = query.Where(i => i.StatusId == statusId);
            if (categoryId.HasValue) query = query.Where(i => i.CategoryId == categoryId);
            if (typeId.HasValue) query = query.Where(i => i.TypeId == typeId);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var s = q.Trim();
                query = query.Where(i => i.Name.Contains(s) || (i.Description != null && i.Description.Contains(s)) || (i.Location != null && i.Location.Contains(s)));
            }

            if (hasPrimaryImage.HasValue)
            {
                if (hasPrimaryImage.Value)
                {
                    query = query.Where(i => i.Images.Any(img => img.IsPrimary));
                }
                else
                {
                    query = query.Where(i => !i.Images.Any(img => img.IsPrimary));
                }
            }

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(i => i.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new ItemListDto(
                    i.Id,
                    i.Name,
                    i.Description,
                    i.Location,
                    i.DateLostFound,
                    i.CreatedAt,
                    i.UserId,
                    i.CategoryId,
                    i.TypeId,
                    i.StatusId,
                    i.User != null ? (i.User.FirstName + " " + i.User.LastName).Trim() : null,
                    i.Category != null ? i.Category.Name : null,
                    i.Type != null ? i.Type.Name : null,
                    i.Status != null ? i.Status.Name : null,
                    i.Images != null ? i.Images.Where(img => img.IsPrimary).Select(img => img.Url).FirstOrDefault() : null
                ))
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetItem(int id)
        {
            var i = await _db.Items
                .Include(x => x.Status)
                .Include(x => x.Category)
                .Include(x => x.Type)
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (i == null) return NotFound();

            var dto = new ItemDetailDto(
                i.Id, i.Name, i.Description, i.Location, i.DateLostFound, i.CreatedAt, i.UpdatedAt,
                i.UserId, i.CategoryId, i.TypeId, i.StatusId,
                i.User != null ? (i.User.FirstName + " " + i.User.LastName).Trim() : null,
                i.Category?.Name, i.Type?.Name, i.Status?.Name
            );
            return Ok(dto);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] ItemCreateDto dto)
        {
            if (!ModelState.IsValid)
            {
                // Log and return validation errors to help debugging from the client
                _logger.LogWarning("Create Item validation failed: {Errors}", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
                return BadRequest(ModelState);
            }

            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required");

            var userId = GetActingUserId();
            if (userId == null) return Forbid();

            var item = new Item
            {
                Name = dto.Name.Trim(),
                Description = dto.Description,
                Location = dto.Location,
                DateLostFound = dto.DateLostFound,
                CategoryId = dto.CategoryId,
                TypeId = dto.TypeId,
                StatusId = dto.StatusId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _db.Items.Add(item);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetItem), new { id = item.Id }, new { id = item.Id });
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] ItemUpdateDto dto)
        {
            var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == id);
            if (item == null) return NotFound();

            if (!IsCurrentUserAdmin())
            {
                var userId = GetActingUserId();
                if (userId == null || item.UserId != userId) return Forbid();
            }

            if (dto.Name != null)
            {
                if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name cannot be empty");
                item.Name = dto.Name.Trim();
            }
            if (dto.Description != null) item.Description = dto.Description;
            if (dto.Location != null) item.Location = dto.Location;
            if (dto.DateLostFound.HasValue) item.DateLostFound = dto.DateLostFound;
            if (dto.CategoryId.HasValue) item.CategoryId = dto.CategoryId;
            if (dto.TypeId.HasValue) item.TypeId = dto.TypeId;
            if (dto.StatusId.HasValue) item.StatusId = dto.StatusId;

            item.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == id);
            if (item == null) return NotFound();

            if (!IsCurrentUserAdmin())
            {
                var userId = GetActingUserId();
                if (userId == null || item.UserId != userId) return Forbid();
            }

            if (item.IsDeleted) return BadRequest("Item already deleted");
            item.IsDeleted = true;
            item.DeletedAt = DateTime.UtcNow;
            item.DeletedByUserId = GetActingUserId();

            await _db.SaveChangesAsync();
            return NoContent();
        }

        private int? GetActingUserId()
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (int.TryParse(sub, out var id)) return id;
            return null;
        }

        private bool IsCurrentUserAdmin()
        {
            return User.IsInRole("Admin") || User.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == "Admin");
        }
    }
}
