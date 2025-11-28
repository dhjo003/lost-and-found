namespace LostAndFoundApp.Models
{
    public class ItemMatch
    {
        public int Id { get; set; }
        public int LostItemId { get; set; }
        public Item? LostItem { get; set; }
        public int FoundItemId { get; set; }
        public Item? FoundItem { get; set; }
        public int CreatorUserId { get; set; }
        public int Score { get; set; } = 0; // match score (0-100)
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DeletedAt { get; set; }
        public int? DeletedByUserId { get; set; }
    }
}
