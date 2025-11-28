namespace LostAndFoundApp.Dtos
{
    public record UserDto(
        int Id,
        string? Email,
        string? FirstName,
        string? LastName,
        string? ProfilePicture,
        string? RoleName,
        DateTime CreatedAt,
        DateTime? LastLogin
    );
}