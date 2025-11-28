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
    [Route("api/[controller]")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<MessagingHub> _hub;

        public MessagesController(AppDbContext db, IHubContext<MessagingHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        [HttpGet("history/{otherUserId}")]
        public async Task<IActionResult> GetHistory(int otherUserId, int page = 1, int pageSize = 100)
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var query = _db.Messages
                .Where(m =>
                    (m.SenderId == userId && m.ReceiverId == otherUserId && !m.SenderDeleted) ||
                    (m.ReceiverId == userId && m.SenderId == otherUserId && !m.ReceiverDeleted))
                .OrderByDescending(m => m.CreatedAt);

            var messages = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var dtos = messages.Select(m => new MessageDto
            {
                Id = m.Id,
                SenderId = m.SenderId,
                ReceiverId = m.ReceiverId,
                Content = m.Content,
                CreatedAt = m.CreatedAt,
                IsRead = m.IsRead,
                ReadAt = m.ReadAt
            }).OrderBy(m => m.CreatedAt).ToList();

            return Ok(dtos);
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] CreateMessageDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            if (dto.ReceiverId == userId) return BadRequest("Cannot send to yourself.");
            if (string.IsNullOrWhiteSpace(dto.Content) || dto.Content.Length > 2000)
                return BadRequest("Content is required and must be <= 2000 chars.");

            // Validate receiver exists (optional)
            var receiver = await _db.Users.FindAsync(dto.ReceiverId);
            if (receiver == null) return NotFound("Receiver not found.");

            var msg = new Message
            {
                SenderId = userId,
                ReceiverId = dto.ReceiverId,
                Content = dto.Content,
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            // Create a persistent Notification entry for the receiver
            var notification = new LostAndFoundApp.Models.Notification
            {
                UserId = dto.ReceiverId,
                Title = "New message",
                Body = msg.Content,
                MetaJson = System.Text.Json.JsonSerializer.Serialize(new { MessageId = msg.Id, FromUserId = userId }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _db.Messages.Add(msg);
            _db.Notifications.Add(notification);

            await _db.SaveChangesAsync();

            var messageDto = new MessageDto
            {
                Id = msg.Id,
                SenderId = msg.SenderId,
                ReceiverId = msg.ReceiverId,
                Content = msg.Content,
                CreatedAt = msg.CreatedAt,
                IsRead = msg.IsRead,
                ReadAt = msg.ReadAt
            };

            // Build notification DTO
            var notificationDto = new NotificationDto
            {
                Id = notification.Id,
                UserId = notification.UserId,
                Title = notification.Title,
                Body = notification.Body,
                MetaJson = notification.MetaJson,
                IsRead = notification.IsRead,
                CreatedAt = notification.CreatedAt
            };

            // Push to receiver's connections
            var conns = LostAndFoundApp.Hubs.MessagingHub.GetConnections(dto.ReceiverId);
            foreach (var connId in conns)
            {
                await _hub.Clients.Client(connId).SendAsync("ReceiveMessage", messageDto);
                await _hub.Clients.Client(connId).SendAsync("ReceiveNotification", notificationDto);
            }

            // Optionally ack to sender's other connections
            var senderConns = LostAndFoundApp.Hubs.MessagingHub.GetConnections(userId);
            foreach (var conn in senderConns)
            {
                await _hub.Clients.Client(conn).SendAsync("MessageSent", messageDto);
            }

            return Ok(messageDto);
        }

        [HttpPost("{id}/soft-delete")]
        public async Task<IActionResult> SoftDelete(int id)
        {
            var userId = GetCurrentUserId();
            var msg = await _db.Messages.FindAsync(id);
            if (msg == null) return NotFound();

            if (msg.SenderId == userId)
            {
                msg.SenderDeleted = true;
                msg.SenderDeletedAt = DateTime.UtcNow;
            }
            else if (msg.ReceiverId == userId)
            {
                msg.ReceiverDeleted = true;
                msg.ReceiverDeletedAt = DateTime.UtcNow;
            }
            else
            {
                return Forbid();
            }

            // Optionally: if both deleted then mark IsDeleted and schedule purge
            if (msg.SenderDeleted && msg.ReceiverDeleted) msg.IsDeleted = true;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id}/undo-delete")]
        public async Task<IActionResult> UndoDelete(int id)
        {
            var userId = GetCurrentUserId();
            var msg = await _db.Messages.FindAsync(id);
            if (msg == null) return NotFound();

            if (msg.SenderId == userId)
            {
                msg.SenderDeleted = false;
                msg.SenderDeletedAt = null;
            }
            else if (msg.ReceiverId == userId)
            {
                msg.ReceiverDeleted = false;
                msg.ReceiverDeletedAt = null;
            }
            else
            {
                return Forbid();
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            // Load visible message projections into memory and group there (simpler and safe)
            var msgsList = await _db.Messages
                .Where(m => (m.SenderId == userId && !m.SenderDeleted) || (m.ReceiverId == userId && !m.ReceiverDeleted))
                .Select(m => new
                {
                    OtherUserId = m.SenderId == userId ? m.ReceiverId : m.SenderId,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    SenderId = m.SenderId,
                    ReceiverId = m.ReceiverId,
                    IsRead = m.IsRead
                })
                .ToListAsync();

            var grouped = msgsList.GroupBy(x => x.OtherUserId)
                .Select(g => new
                {
                    OtherUserId = g.Key,
                    Last = g.OrderByDescending(x => x.CreatedAt).FirstOrDefault(),
                    UnreadCount = g.Count(x => x.ReceiverId == userId && !x.IsRead)
                })
                .OrderByDescending(x => x.Last != null ? x.Last.CreatedAt : DateTime.MinValue)
                .ToList();

            var userIds = grouped.Select(g => g.OtherUserId).ToList();
            var users = await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => (u.FirstName + " " + (u.LastName ?? "")).Trim() == "" ? u.Email : (u.FirstName + " " + (u.LastName ?? "")).Trim());

            var result = grouped.Select(g => new ConversationListItemDto
            {
                OtherUserId = g.OtherUserId,
                OtherUserName = users.ContainsKey(g.OtherUserId) ? (users[g.OtherUserId] ?? "User") : "User",
                LastMessage = g.Last != null ? g.Last.Content : string.Empty,
                LastMessageAt = g.Last != null ? g.Last.CreatedAt : DateTime.MinValue,
                UnreadCount = g.UnreadCount
            }).ToList();

            return Ok(result);
        }

        [HttpPost("conversations/{otherUserId}/delete")]
        public async Task<IActionResult> DeleteConversation(int otherUserId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var msgs = await _db.Messages.Where(m =>
                (m.SenderId == userId && m.ReceiverId == otherUserId) ||
                (m.ReceiverId == userId && m.SenderId == otherUserId)
            ).ToListAsync();

            foreach (var m in msgs)
            {
                if (m.SenderId == userId)
                {
                    m.SenderDeleted = true;
                    m.SenderDeletedAt = DateTime.UtcNow;
                }
                if (m.ReceiverId == userId)
                {
                    m.ReceiverDeleted = true;
                    m.ReceiverDeletedAt = DateTime.UtcNow;
                }
                if (m.SenderDeleted && m.ReceiverDeleted) m.IsDeleted = true;
            }

            await _db.SaveChangesAsync();

            // Notify other user's connections that conversation was deleted (so they can update UI)
            var otherConns = LostAndFoundApp.Hubs.MessagingHub.GetConnections(otherUserId);
            foreach (var conn in otherConns)
            {
                await _hub.Clients.Client(conn).SendAsync("ConversationDeleted", new { OtherUserId = userId });
            }

            return NoContent();
        }

        [HttpPost("{id}/mark-read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var userId = GetCurrentUserId();
            var msg = await _db.Messages.FindAsync(id);
            if (msg == null) return NotFound();
            if (msg.ReceiverId != userId) return Forbid();

            msg.IsRead = true;
            msg.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // Notify sender that message was read (optional)
            var senderConns = LostAndFoundApp.Hubs.MessagingHub.GetConnections(msg.SenderId);
            foreach (var conn in senderConns)
            {
                await _hub.Clients.Client(conn).SendAsync("MessageRead", new { MessageId = msg.Id, ReadAt = msg.ReadAt });
            }

            return NoContent();
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = GetCurrentUserId();
            var count = await _db.Messages.Where(m => m.ReceiverId == userId && !m.IsRead && !m.ReceiverDeleted).CountAsync();
            return Ok(new { Unread = count });
        }
    }
}