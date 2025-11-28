using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Dtos;
using LostAndFoundApp.Hubs;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/item-matches")]
    [Authorize]
    public class ItemMatchesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<ItemMatchesController> _logger;
        private readonly IHubContext<MessagingHub> _hub;

        public ItemMatchesController(AppDbContext db, ILogger<ItemMatchesController> logger, IHubContext<MessagingHub> hub)
        {
            _db = db;
            _logger = logger;
            _hub = hub;
        }

        private int? GetActingUserId()
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (int.TryParse(sub, out var id)) return id;
            return null;
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ItemMatchCreateDto dto)
        {
            var userId = GetActingUserId();
            if (userId == null) return Forbid();

            if (dto.LostItemId == dto.FoundItemId) return BadRequest("Lost and Found item must be different.");

            var lost = await _db.Items.FirstOrDefaultAsync(i => i.Id == dto.LostItemId);
            var found = await _db.Items.FirstOrDefaultAsync(i => i.Id == dto.FoundItemId);
            if (lost == null || found == null) return BadRequest("Invalid item ids");

            var match = new ItemMatch
            {
                LostItemId = dto.LostItemId,
                FoundItemId = dto.FoundItemId,
                CreatorUserId = userId.Value,
                Score = dto.Score,
                CreatedAt = DateTime.UtcNow
            };
            _db.ItemMatches.Add(match);
            await _db.SaveChangesAsync();

            // create notifications for both owners (if they exist and are different users)
            var recipients = new List<int>();
            if (lost.UserId.HasValue) recipients.Add(lost.UserId.Value);
            if (found.UserId.HasValue && found.UserId != lost.UserId) recipients.Add(found.UserId.Value);

            foreach (var r in recipients.Distinct())
            {
                var title = "Possible match found";
                var body = $"A possible match (score {match.Score}) was suggested between items {match.LostItemId} and {match.FoundItemId}.";
                var notif = new Notification { UserId = r, Title = title, Body = body, MetaJson = System.Text.Json.JsonSerializer.Serialize(new { type = "itemmatch", itemMatchId = match.Id }) };
                _db.Notifications.Add(notif);
            }
            await _db.SaveChangesAsync();

            // notify connected clients via hub
            foreach (var r in recipients.Distinct())
            {
                var conns = MessagingHub.GetConnections(r);
                var suppressAlert = (r == match.CreatorUserId);
                var payload = new { type = "itemmatch", itemMatchId = match.Id, lostItemId = match.LostItemId, foundItemId = match.FoundItemId, score = match.Score, suppressAlert };
                foreach (var c in conns) await _hub.Clients.Client(c).SendAsync("ReceiveNotification", payload);
            }

            return CreatedAtAction(nameof(GetById), new { id = match.Id }, new ItemMatchDto { Id = match.Id, LostItemId = match.LostItemId, FoundItemId = match.FoundItemId, CreatorUserId = match.CreatorUserId, Score = match.Score, CreatedAt = match.CreatedAt });
        }

        [HttpPost("{id}/soft-delete")]
        public async Task<IActionResult> SoftDelete(int id)
        {
            var userId = GetActingUserId();
            if (userId == null) return Forbid();

            var match = await _db.ItemMatches.FirstOrDefaultAsync(m => m.Id == id);
            if (match == null) return NotFound();

            match.IsDeleted = true;
            match.DeletedAt = DateTime.UtcNow;
            match.DeletedByUserId = userId;
            await _db.SaveChangesAsync();

            // notify both owners similar to create
            var lost = await _db.Items.FirstOrDefaultAsync(i => i.Id == match.LostItemId);
            var found = await _db.Items.FirstOrDefaultAsync(i => i.Id == match.FoundItemId);
            var recipients = new List<int>();
            if (lost?.UserId != null) recipients.Add(lost.UserId.Value);
            if (found?.UserId != null && found.UserId != lost?.UserId) recipients.Add(found.UserId.Value);

            foreach (var r in recipients.Distinct())
            {
                var title = "Match removed";
                var body = $"A match between items {match.LostItemId} and {match.FoundItemId} was removed.";
                var notif = new Notification { UserId = r, Title = title, Body = body, MetaJson = System.Text.Json.JsonSerializer.Serialize(new { type = "itemmatch_deleted", itemMatchId = match.Id }) };
                _db.Notifications.Add(notif);
            }
            await _db.SaveChangesAsync();

            foreach (var r in recipients.Distinct())
            {
                var conns = MessagingHub.GetConnections(r);
                var suppressAlert = (r == match.DeletedByUserId);
                var payload = new { type = "itemmatch_deleted", itemMatchId = match.Id, suppressAlert };
                foreach (var c in conns) await _hub.Clients.Client(c).SendAsync("ReceiveNotification", payload);
            }

            return NoContent();
        }

        [HttpGet("item/{itemId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetForItem(int itemId)
        {
            var list = await _db.ItemMatches.AsNoTracking()
                .Where(m => !m.IsDeleted && (m.LostItemId == itemId || m.FoundItemId == itemId))
                .Select(m => new ItemMatchDto { Id = m.Id, LostItemId = m.LostItemId, FoundItemId = m.FoundItemId, CreatorUserId = m.CreatorUserId, Score = m.Score, IsDeleted = m.IsDeleted, CreatedAt = m.CreatedAt })
                .ToListAsync();
            return Ok(list);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userId = GetActingUserId();
            var isAdmin = User.IsInRole("Admin");

            IQueryable<ItemMatch> query = _db.ItemMatches.AsNoTracking().Where(m => !m.IsDeleted);

            if (!isAdmin)
            {
                if (userId == null) return Forbid();
                // restrict to matches where the user owns the lost or found item or is the creator
                query = query.Where(m => m.CreatorUserId == userId ||
                    _db.Items.Any(i => i.Id == m.LostItemId && i.UserId == userId) ||
                    _db.Items.Any(i => i.Id == m.FoundItemId && i.UserId == userId));
            }

            var list = await query.Select(m => new ItemMatchDto { Id = m.Id, LostItemId = m.LostItemId, FoundItemId = m.FoundItemId, CreatorUserId = m.CreatorUserId, Score = m.Score, IsDeleted = m.IsDeleted, CreatedAt = m.CreatedAt }).ToListAsync();
            return Ok(list);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var m = await _db.ItemMatches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (m == null) return NotFound();

            var userId = GetActingUserId();
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin)
            {
                if (userId == null) return Forbid();
                var owns = await _db.Items.AnyAsync(i => (i.Id == m.LostItemId || i.Id == m.FoundItemId) && i.UserId == userId);
                if (!owns && m.CreatorUserId != userId) return Forbid();
            }

            return Ok(new ItemMatchDto { Id = m.Id, LostItemId = m.LostItemId, FoundItemId = m.FoundItemId, CreatorUserId = m.CreatorUserId, Score = m.Score, IsDeleted = m.IsDeleted, CreatedAt = m.CreatedAt });
        }
    }
}
