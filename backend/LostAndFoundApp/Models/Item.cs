namespace LostAndFoundApp.Models
{
    public class Item
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public User? User { get; set; }
        public int? CategoryId { get; set; }
        public Category? Category { get; set; }
        public int? StatusId { get; set; }
        public Status? Status { get; set; }
        public int? TypeId { get; set; }
        public ItemType? Type { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Location { get; set; }
        public DateTime? DateLostFound { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public int? DeletedByUserId { get; set; }
        public ICollection<ItemImage>? Images { get; set; } = new List<ItemImage>();
    }
}