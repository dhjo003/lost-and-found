using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/statuses")]
    public class StatusesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public StatusesController(AppDbContext db) { _db = db; }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll() => Ok(await _db.Statuses.OrderBy(s => s.Name).ToListAsync());

        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> Get(int id)
        {
            var e = await _db.Statuses.FindAsync(id);
            return e == null ? NotFound() : Ok(e);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] Status model)
        {
            if (string.IsNullOrWhiteSpace(model.Name)) return BadRequest("Name is required");
            var name = model.Name.Trim();
            if (await _db.Statuses.AnyAsync(x => x.Name == name)) return BadRequest("Name must be unique");
            model.Name = name;
            model.CreatedAt = DateTime.UtcNow;
            _db.Statuses.Add(model);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] Status model)
        {
            var e = await _db.Statuses.FindAsync(id);
            if (e == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(model.Name))
            {
                var name = model.Name.Trim();
                if (await _db.Statuses.AnyAsync(x => x.Id != id && x.Name == name)) return BadRequest("Name must be unique");
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
            var e = await _db.Statuses.FindAsync(id);
            if (e == null) return NotFound();

            var inUse = await _db.Items.AnyAsync(i => i.StatusId == id);
            if (inUse)
            {
                var count = await _db.Items.CountAsync(i => i.StatusId == id);
                return Conflict(new { error = "Status is used by items and cannot be deleted.", itemCount = count });
            }
            _db.Statuses.Remove(e);
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

            [HttpGet("{id}/usage")]
            [Authorize(Roles = "Admin")]
            public async Task<IActionResult> GetUsage(int id)
            {
                var count = await _db.Items.CountAsync(i => i.StatusId == id);
                return Ok(new { id, itemCount = count });
            }
    }
}
