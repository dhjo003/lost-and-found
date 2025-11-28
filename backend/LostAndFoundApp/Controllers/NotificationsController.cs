using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Dtos;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public NotificationsController(AppDbContext db)
        {
            _db = db;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        [HttpGet]
        public async Task<IActionResult> GetNotifications(int page = 1, int pageSize = 50)
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var query = _db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt);

            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).AsNoTracking().ToListAsync();

            var dtos = items.Select(n => new NotificationDto
            {
                Id = n.Id,
                UserId = n.UserId,
                Title = n.Title,
                Body = n.Body,
                MetaJson = n.MetaJson,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList();

            return Ok(dtos);
        }

        [HttpPost("{id}/mark-read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var userId = GetCurrentUserId();
            var n = await _db.Notifications.FindAsync(id);
            if (n == null) return NotFound();
            if (n.UserId != userId) return Forbid();

            n.IsRead = true;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var items = await _db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
            if (items.Count == 0) return NoContent();

            foreach (var n in items)
            {
                n.IsRead = true;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetCurrentUserId();
            var n = await _db.Notifications.FindAsync(id);
            if (n == null) return NotFound();
            if (n.UserId != userId) return Forbid();

            _db.Notifications.Remove(n);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
