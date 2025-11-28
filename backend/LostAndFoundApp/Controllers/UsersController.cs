using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using LostAndFoundApp.Data;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using LostAndFoundApp.Dtos;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IMemoryCache _cache;
        private readonly IHttpClientFactory _httpFactory;
        private readonly ILogger<UsersController> _logger;

        public UsersController(AppDbContext db, IMemoryCache cache, IHttpClientFactory httpFactory, ILogger<UsersController> logger)
        {
            _db = db;
            _cache = cache;
            _httpFactory = httpFactory;
            _logger = logger;
        }

        [HttpGet("{id}/avatar")]
        public async Task<IActionResult> GetAvatar(int id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null || string.IsNullOrEmpty(user.ProfilePicture))
                return NotFound();

            var cacheKey = $"avatar_{id}";
            if (_cache.TryGetValue<byte[]>(cacheKey, out var cachedBytes))
            {
                _logger.LogDebug("Avatar cache HIT for user {UserId}", id);
                if (cachedBytes == null || cachedBytes.Length == 0)
                {
                    _logger.LogWarning("Cached avatar for user {UserId} is empty", id);
                    return StatusCode(502);
                }

                return File(cachedBytes, "image/*");
            }

            var client = _httpFactory.CreateClient();
            try
            {
                // Fetch the remote image (short timeout)
                client.Timeout = TimeSpan.FromSeconds(8);
                using var resp = await client.GetAsync(user.ProfilePicture);
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Failed to fetch avatar for user {UserId}: {Status}", id, resp.StatusCode);
                    return StatusCode((int)resp.StatusCode);
                }

                var contentType = resp.Content.Headers.ContentType?.MediaType ?? "image/png";
                var bytes = await resp.Content.ReadAsByteArrayAsync();

                if (bytes == null || bytes.Length == 0)
                {
                    _logger.LogWarning("Fetched avatar for user {UserId} was empty", id);
                    return StatusCode(502);
                }

                // Cache for one hour (tune TTL as needed)
                _cache.Set(cacheKey, bytes, TimeSpan.FromHours(1));

                _logger.LogInformation("Fetched and cached avatar for user {UserId}", id);
                return File(bytes, contentType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching avatar for user {UserId}", id);
                return StatusCode(502); // Bad gateway
            }
        }

        [HttpGet]
        [Authorize (Roles = "Admin")]
        public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? q = null)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;

            IQueryable<User> query = _db.Users.Include(u => u.Role).AsQueryable(); // global filter hides deleted

            if (!string.IsNullOrWhiteSpace(q))
            {
                var s = q.Trim();
                query = query.Where(u =>
                    (u.Email != null && u.Email.Contains(s)) ||
                    (u.FirstName != null && u.FirstName.Contains(s)) ||
                    (u.LastName != null && u.LastName.Contains(s))
                );
            }

            var total = await query.CountAsync();
            var items = await query.OrderBy(u => u.Id)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(u => new UserDto(u.Id, u.Email, u.FirstName, u.LastName, u.ProfilePicture, u.Role!.Name, u.CreatedAt, u.LastLogin))
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? q = null)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;

            IQueryable<User> query = _db.Users.IgnoreQueryFilters().Where(u => u.IsDeleted).Include(u => u.Role).AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
            {
                var s = q.Trim();
                query = query.Where(u =>
                    (u.Email != null && u.Email.Contains(s)) ||
                    (u.FirstName != null && u.FirstName.Contains(s)) ||
                    (u.LastName != null && u.LastName.Contains(s))
                );
            }

            var total = await query.CountAsync();
            var items = await query.OrderBy(u => u.DeletedAt).Skip((page - 1) * pageSize).Take(pageSize)
                .Select(u => new UserDto(u.Id, u.Email, u.FirstName, u.LastName, u.ProfilePicture, u.Role!.Name, u.CreatedAt, u.LastLogin))
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/soft-delete")]
        public async Task<IActionResult> SoftDeleteUser(int id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            if (user.IsDeleted) return BadRequest("User already deleted.");

            var currentUserId = GetActingUserId();
            if (currentUserId == null) return Forbid();

            if (user.Id == currentUserId) return BadRequest("Cannot delete yourself.");

            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
            user.DeletedByUserId = currentUserId;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreUser(int id)
        {
            var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();
            if (!user.IsDeleted) return BadRequest("User is not deleted.");

            user.IsDeleted = false;
            user.DeletedAt = null;
            user.DeletedByUserId = null;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/role")]
        public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.RoleName))
                return BadRequest("RoleName is required.");

            var currentUserId = GetActingUserId();
            if (currentUserId == null) return Forbid();

            // Prevent users from changing their own role
            if (id == currentUserId)
                return BadRequest("You cannot change your own role.");

            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var newRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == req.RoleName);
            if (newRole == null) return BadRequest("Role not found.");

            user.RoleId = newRole.RoleId;
            await _db.SaveChangesAsync();

            return Ok(new { id = user.Id, roleName = newRole.Name });
        }

    // Backwards-compatible route: /api/users/{id}
    [HttpGet("{id}")]
    public Task<IActionResult> Get(int id) => GetById(id);

    [HttpGet("{id}/profile")]
    public async Task<IActionResult> GetById(int id)
        {
            var user = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return NotFound();

            var dto = new UserDto(
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                user.ProfilePicture,
                user.Role?.Name,
                user.CreatedAt,
                user.LastLogin
            );

            return Ok(dto);
        }

        // Public: list items created by a given user (paged)
        [HttpGet("{id}/items")]
        public async Task<IActionResult> GetItemsByUser(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? q = null, [FromQuery] int? typeId = null, [FromQuery] int? statusId = null, [FromQuery] int? categoryId = null)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;

            IQueryable<Item> query = _db.Items
                .Where(i => i.UserId == id)
                .Include(i => i.Status)
                .Include(i => i.Category)
                .Include(i => i.Type)
                .Include(i => i.User)
                .Include(i => i.Images);

            if (typeId.HasValue) query = query.Where(i => i.TypeId == typeId.Value);
            if (statusId.HasValue) query = query.Where(i => i.StatusId == statusId.Value);
            if (categoryId.HasValue) query = query.Where(i => i.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var s = q.Trim();
                query = query.Where(i => i.Name.Contains(s) || (i.Description != null && i.Description.Contains(s)) || (i.Location != null && i.Location.Contains(s)));
            }

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(i => i.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new Dtos.ItemListDto(
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
        // Helper: get current acting user's id from JWT (sub claim or NameIdentifier)
        private int? GetActingUserId()
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (int.TryParse(sub, out var id)) return id;
            return null;
        }

        // Helper: check if current user is admin
        private bool IsCurrentUserAdmin()
        {
            // Uses role claim (adjust if you use a different claim type)
            return User.IsInRole("Admin") || User.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == "Admin");
        }
    }

    public record UpdateRoleRequest(string RoleName);
}