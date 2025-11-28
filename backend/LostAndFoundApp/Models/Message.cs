using System;

namespace LostAndFoundApp.Models
{
    public class Message
    {
        public int Id { get; set; }
        public int SenderId { get; set; }
        public int ReceiverId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; } = false;
        public DateTime? ReadAt { get; set; }

        // Per-user soft-delete flags
        public bool SenderDeleted { get; set; } = false;
        public DateTime? SenderDeletedAt { get; set; }
        public bool ReceiverDeleted { get; set; } = false;
        public DateTime? ReceiverDeletedAt { get; set; }

        // Optional: mark for hard-delete when both sides deleted
        public bool IsDeleted { get; set; } = false;
    }
}