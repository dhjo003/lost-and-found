namespace LostAndFoundApp.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; } // recipient
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string? MetaJson { get; set; } // optional small JSON
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}