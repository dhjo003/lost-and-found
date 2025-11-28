using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/item-types")]
    public class ItemTypesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public ItemTypesController(AppDbContext db) { _db = db; }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll() => Ok(await _db.ItemTypes.OrderBy(t => t.Name).ToListAsync());

        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> Get(int id)
        {
            var e = await _db.ItemTypes.FindAsync(id);
            return e == null ? NotFound() : Ok(e);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] ItemType model)
        {
            if (string.IsNullOrWhiteSpace(model.Name)) return BadRequest("Name is required");
            var name = model.Name.Trim();
            if (await _db.ItemTypes.AnyAsync(x => x.Name == name)) return BadRequest("Name must be unique");
            model.Name = name;
            model.CreatedAt = DateTime.UtcNow;
            _db.ItemTypes.Add(model);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] ItemType model)
        {
            var e = await _db.ItemTypes.FindAsync(id);
            if (e == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(model.Name))
            {
                var name = model.Name.Trim();
                if (await _db.ItemTypes.AnyAsync(x => x.Id != id && x.Name == name)) return BadRequest("Name must be unique");
                e.Name = name;
            }
            e.Description = model.Description;
            e.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var e = await _db.ItemTypes.FindAsync(id);
            if (e == null) return NotFound();

            var inUse = await _db.Items.AnyAsync(i => i.TypeId == id);
            if (inUse)
            {
                var count = await _db.Items.CountAsync(i => i.TypeId == id);
                return Conflict(new { error = "ItemType is in use by existing items. Reassign or merge before deleting.", itemCount = count });
            }
            _db.ItemTypes.Remove(e);
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
                var source = await _db.ItemTypes.FindAsync(id);
                var target = await _db.ItemTypes.FindAsync(targetId);
                if (source == null || target == null) return NotFound();

                using var tx = await _db.Database.BeginTransactionAsync();
                try
                {
                    var items = await _db.Items.Where(i => i.TypeId == id).ToListAsync();
                    foreach (var it in items) it.TypeId = targetId;
                    await _db.SaveChangesAsync();

                    _db.ItemTypes.Remove(source);
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
                var count = await _db.Items.CountAsync(i => i.TypeId == id);
                return Ok(new { id, itemCount = count });
            }
    }
}
