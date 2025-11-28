namespace LostAndFoundApp.Dtos
{
    public class ItemMatchCreateDto
    {
        public required int LostItemId { get; set; }
        public required int FoundItemId { get; set; }
        public int Score { get; set; }
    }

    public class ItemMatchDto
    {
        public int Id { get; set; }
        public int LostItemId { get; set; }
        public int FoundItemId { get; set; }
        public int CreatorUserId { get; set; }
        public int Score { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
