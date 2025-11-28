namespace LostAndFoundApp.Dtos
{
    public record ItemListDto(
        int Id,
        string Name,
        string? Description,
        string? Location,
        DateTime? DateLostFound,
        DateTime CreatedAt,
        int? UserId,
        int? CategoryId,
        int? TypeId,
        int? StatusId,
        string? UserName,
        string? CategoryName,
        string? TypeName,
        string? StatusName,
        string? PrimaryImageUrl
    );

    public record ItemDetailDto(
        int Id,
        string Name,
        string? Description,
        string? Location,
        DateTime? DateLostFound,
        DateTime CreatedAt,
        DateTime? UpdatedAt,
        int? UserId,
        int? CategoryId,
        int? TypeId,
        int? StatusId,
        string? UserName,
        string? CategoryName,
        string? TypeName,
        string? StatusName
    );

    public class ItemCreateDto
    {
        public required string Name { get; set; }
        public string? Description { get; set; }
        public string? Location { get; set; }
        public DateTime? DateLostFound { get; set; }
        public int? CategoryId { get; set; }
        public int? TypeId { get; set; }
        public int? StatusId { get; set; }
    }

    public class ItemUpdateDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Location { get; set; }
        public DateTime? DateLostFound { get; set; }
        public int? CategoryId { get; set; }
        public int? TypeId { get; set; }
        public int? StatusId { get; set; }
    }
}
