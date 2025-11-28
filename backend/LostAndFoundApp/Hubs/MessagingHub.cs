using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LostAndFoundApp.Hubs
{
    // Authorize so JWT is required for hub connections
    [Authorize]
    public class MessagingHub : Hub
    {
        // In-memory mapping: userId -> set of connectionIds
        // Note: For multiple server instances use Redis backplane instead.
        private static readonly ConcurrentDictionary<int, HashSet<string>> _userConnections = new();

        private int GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? Context.User?.FindFirst("sub")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        public override Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId > 0)
            {
                var set = _userConnections.GetOrAdd(userId, _ => new HashSet<string>());
                lock (set) set.Add(Context.ConnectionId);
            }
            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            if (userId > 0 && _userConnections.TryGetValue(userId, out var set))
            {
                lock (set)
                {
                    set.Remove(Context.ConnectionId);
                    if (set.Count == 0) _userConnections.TryRemove(userId, out _);
                }
            }
            return base.OnDisconnectedAsync(exception);
        }

        // Helper for server-side code to get connection ids for a user
        public static IEnumerable<string> GetConnections(int userId)
        {
            if (_userConnections.TryGetValue(userId, out var set))
            {
                lock (set) return set.ToArray();
            }
            return Enumerable.Empty<string>();
        }

        // Optional: allow client to call hub directly to send ephemeral message.
        // Recommended pattern: client POSTs to API to persist message; server notifies via hub.
        public async Task SendPrivateMessage(int receiverId, string content)
        {
            var senderId = GetUserId();
            if (senderId == 0 || senderId == receiverId) return;

            var payload = new
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = content,
                CreatedAt = DateTime.UtcNow
            };

            if (_userConnections.TryGetValue(receiverId, out var recSet))
            {
                foreach (var conn in recSet.ToArray())
                {
                    await Clients.Client(conn).SendAsync("ReceiveMessage", payload);
                }
            }

            if (_userConnections.TryGetValue(senderId, out var sSet))
            {
                foreach (var conn in sSet.ToArray())
                {
                    await Clients.Client(conn).SendAsync("MessageSent", payload);
                }
            }
        }
    }
}