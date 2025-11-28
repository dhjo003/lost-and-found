using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/categories")]
    public class CategoriesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public CategoriesController(AppDbContext db) { _db = db; }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll() => Ok(await _db.Categories.OrderBy(c => c.Name).ToListAsync());

        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> Get(int id)
        {
            var c = await _db.Categories.FindAsync(id);
            return c == null ? NotFound() : Ok(c);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] Category model)
        {
            if (string.IsNullOrWhiteSpace(model.Name)) return BadRequest("Name is required");
            model.Name = model.Name.Trim();
            if (await _db.Categories.AnyAsync(x => x.Name == model.Name)) return BadRequest("Name must be unique");
            model.CreatedAt = DateTime.UtcNow;
            _db.Categories.Add(model);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] Category model)
        {
            var c = await _db.Categories.FindAsync(id);
            if (c == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(model.Name))
            {
                var name = model.Name.Trim();
                if (await _db.Categories.AnyAsync(x => x.Id != id && x.Name == name)) return BadRequest("Name must be unique");
                c.Name = name;
            }
            c.Description = model.Description;
            c.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var c = await _db.Categories.FindAsync(id);
            if (c == null) return NotFound();

            var inUse = await _db.Items.AnyAsync(i => i.CategoryId == id);
            if (inUse)
            {
                var count = await _db.Items.CountAsync(i => i.CategoryId == id);
                return Conflict(new { error = "Category is in use by existing items. Reassign or merge before deleting.", itemCount = count });
            }
            _db.Categories.Remove(c);
            try
            {
                await _db.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateException)
            {
                return Conflict(new { error = "Delete blocked due to existing references." });
            }
        }

        [HttpPost("{id}/merge-into/{targetId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> MergeInto(int id, int targetId)
        {
            if (id == targetId) return BadRequest(new { error = "Source and target must differ" });
            var source = await _db.Categories.FindAsync(id);
            var target = await _db.Categories.FindAsync(targetId);
            if (source == null || target == null) return NotFound();

            using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                var items = await _db.Items.Where(i => i.CategoryId == id).ToListAsync();
                foreach (var it in items) it.CategoryId = targetId;
                await _db.SaveChangesAsync();

                _db.Categories.Remove(source);
                await _db.SaveChangesAsync();
                await tx.CommitAsync();
                return NoContent();
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }

        [HttpGet("{id}/usage")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsage(int id)
        {
            var count = await _db.Items.CountAsync(i => i.CategoryId == id);
            return Ok(new { id, itemCount = count });
        }
    }
}
