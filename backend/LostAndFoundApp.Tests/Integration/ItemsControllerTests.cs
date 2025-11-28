using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using LostAndFoundApp.Data;

namespace LostAndFoundApp.Tests.Integration
{
    public class ItemsControllerTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;

        public ItemsControllerTests(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task GetItems_ReturnsSuccessAndJson()
        {
            // Configure the test host to use SQLite in-memory. Do NOT build a temporary
            // provider inside ConfigureServices (that can leave provider services registered)
            var factory = _factory.WithWebHostBuilder(builder =>
            {
                // ensure the app skips its normal MySQL registration
                builder.UseSetting("environment", "Testing");

                builder.ConfigureServices(services =>
                {
                    // remove any existing AppDbContext/DbContextOptions registrations so we can register a test provider
                    services.RemoveAll(typeof(DbContextOptions<AppDbContext>));
                    services.RemoveAll(typeof(AppDbContext));

                    // register a shared SQLite in-memory connection for tests so the
                    // schema and data are visible across different DbContext instances
                    var connection = new Microsoft.Data.Sqlite.SqliteConnection("DataSource=:memory:;Cache=Shared");
                    connection.Open();
                    services.AddSingleton(connection);
                    services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
                });
            });

            // Create the client (this will build the host). After the host is built, use
            // the host's service provider to open the in-memory connection and seed data.
            var client = factory.CreateClient();

            string jwt;
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Database.OpenConnection();
                db.Database.EnsureCreated();
                // seed a minimal item for the list
                db.Items.Add(new Models.Item { Name = "TestItem" });
                db.SaveChanges();

                // create a JWT using the test configuration so we can call authenticated endpoints
                var config = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
                var jwtKey = config["Jwt:Key"] ?? "TestSecretKey_DoNotUse_InProduction_ChangeThis";
                var keyBytes = System.Text.Encoding.UTF8.GetBytes(jwtKey);
                var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
                {
                    Subject = new System.Security.Claims.ClaimsIdentity(new[] {
                        new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, "1"),
                        new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Email, "test@example.com"),
                        new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "User")
                    }),
                    Expires = System.DateTime.UtcNow.AddHours(1),
                    SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(keyBytes), Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature),
                    Issuer = config["Jwt:Issuer"] ?? "LostAndFoundApp",
                    Audience = config["Jwt:Audience"] ?? "LostAndFoundAppAudience"
                };
                var token = tokenHandler.CreateToken(tokenDescriptor);
                jwt = tokenHandler.WriteToken(token);
            }

            // attach the JWT so we can access protected endpoints
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", jwt);
            var res = await client.GetAsync("/api/items");
            res.EnsureSuccessStatusCode();
            var text = await res.Content.ReadAsStringAsync();
            Assert.Contains("TestItem", text);
        }
    }
}
