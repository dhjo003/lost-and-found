using System.Text;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using LostAndFoundApp.Data;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<AuthController> _logger;

        public AuthController(AppDbContext db, IConfiguration config, ILogger<AuthController> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
        }

        public class GoogleSignInRequest
        {
            public string IdToken { get; set; } = string.Empty;
        }

        [HttpPost("google")]
        public async Task<IActionResult> GoogleSignIn([FromBody] GoogleSignInRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.IdToken))
                return BadRequest(new { error = "idToken is required" });

            var googleClientId = _config["Authentication:Google:ClientId"];
            if (string.IsNullOrWhiteSpace(googleClientId))
            {
                _logger.LogError("Google ClientId not configured");
                return StatusCode(500, new { error = "Server misconfiguration" });
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                var settings = new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { googleClientId }
                };
                payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
            }
            catch (InvalidJwtException ex)
            {
                // Log the exception message and full exception for debugging (includes audience/expiry details)
                _logger.LogWarning(ex, "Invalid Google ID token: {Message}", ex.Message);
                _logger.LogDebug(ex, "Google token validation exception: {Exception}", ex.ToString());
                return Unauthorized(new { error = "Invalid Google token" });
            }

            // Upsert user. Adjust fields to match your User model properties.
            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.GoogleId == payload.Subject || u.Email == payload.Email);
            var now = DateTime.UtcNow;

            // If user exists but is soft-deleted, deny sign-in.
            if (user != null && user.IsDeleted)
            {
                _logger.LogWarning("Sign-in attempt for soft-deleted user {Email} / GoogleId {GoogleId}", payload.Email, payload.Subject);
                return Unauthorized(new { error = "Account disabled" });
            }

            if (user == null)
            {
                user = new User
                {
                    GoogleId = payload.Subject,
                    Email = payload.Email,
                    FirstName = payload.GivenName,
                    LastName = payload.FamilyName,
                    ProfilePicture = payload.Picture,
                    CreatedAt = now,
                    LastLogin = now,
                    RoleId = 1,
                    IsDeleted = false
                };
                _db.Users.Add(user);
            }
            else
            {
                user.GoogleId ??= payload.Subject;
                user.FirstName ??= payload.GivenName;
                user.LastName ??= payload.FamilyName;
                user.ProfilePicture ??= payload.Picture;
                user.LastLogin = now;
                _db.Users.Update(user);
            }

            await _db.SaveChangesAsync();

            // Issue JWT
            var jwtKey = _config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key not configured");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "LostAndFoundApp";
            var jwtAudience = _config["Jwt:Audience"] ?? "LostAndFoundAppAudience";
            var expiresMinutes = int.TryParse(_config["Jwt:ExpiresMinutes"], out var mins) ? mins : 60;
            
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var roleName = user.Role?.Name ?? (user.RoleId.HasValue ? (await _db.Roles.FindAsync(user.RoleId.Value))?.Name : null) ?? "User";

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.Role, roleName)
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(expiresMinutes),
                Issuer = jwtIssuer,
                Audience = jwtAudience,
                SigningCredentials = creds
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwt = tokenHandler.WriteToken(token);

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
    }
}