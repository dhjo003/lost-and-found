using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Hosting;
using LostAndFoundApp.Data;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/test")]
    public class TestController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly IHostEnvironment _env;

        public TestController(AppDbContext db, IConfiguration config, IHostEnvironment env)
        {
            _db = db;
            _config = config;
            _env = env;
        }

        // Issue a JWT for the given user id or create a test user if missing.
        // Only available in Development or Testing environments.
        [HttpPost("token")] 
        public async Task<IActionResult> IssueToken([FromBody] TokenRequest req)
        {
            if (!_env.IsDevelopment() && !_env.IsEnvironment("Testing"))
                return NotFound();

            if (req == null) return BadRequest();

            var testEmail = req.Email ?? "playwright@test.local";
            var testGoogleId = req.GoogleId ?? "playwright-test-1";

            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.GoogleId == testGoogleId || u.Email == testEmail);
            var now = DateTime.UtcNow;
            if (user == null)
            {
                user = new User
                {
                    GoogleId = testGoogleId,
                    Email = testEmail,
                    FirstName = req.FirstName ?? "Playwright",
                    LastName = req.LastName ?? "Tester",
                    CreatedAt = now,
                    LastLogin = now,
                    RoleId = 1,
                    IsDeleted = false
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();
            }

            var jwtKey = _config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key not configured");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "LostAndFoundApp";
            var jwtAudience = _config["Jwt:Audience"] ?? "LostAndFoundAppAudience";

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var roleName = user.Role?.Name ?? (user.RoleId.HasValue ? (await _db.Roles.FindAsync(user.RoleId.Value))?.Name : null) ?? "User";

            var claims = new List<Claim>
            {
                new Claim(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.Role, roleName)
            };

            var expiresMinutes = int.TryParse(_config["Jwt:ExpiresMinutes"], out var mins) ? mins : 60;

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(expiresMinutes),
                Issuer = jwtIssuer,
                Audience = jwtAudience,
                SigningCredentials = creds
            };

            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var token = handler.CreateToken(tokenDescriptor);
            var jwt = handler.WriteToken(token);

            return Ok(new
            {
                token = jwt,
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    firstName = user.FirstName,
                    lastName = user.LastName,
                    avatarUrl = $"/api/users/{user.Id}/avatar",
                    roleName = roleName
                }
            });
        }

        public class TokenRequest
        {
            public int? UserId { get; set; }
            public string? Email { get; set; }
            public string? GoogleId { get; set; }
            public string? FirstName { get; set; }
            public string? LastName { get; set; }
        }
    }
}
