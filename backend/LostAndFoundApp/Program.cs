using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using LostAndFoundApp.Data;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration helpers ---
var configuration = builder.Configuration;

// --- Services ---
// Controllers & OpenAPI
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        // Avoid serializer cycles by ignoring circular references globally.
        opts.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        opts.JsonSerializerOptions.MaxDepth = 64;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi(); // requires Microsoft.AspNetCore.OpenApi package
// Swagger (Swashbuckle)
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "LostAndFoundApp API", Version = "v1" });
    // Add JWT auth support to Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: 'Bearer {token}'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// CORS - allow your frontend origins (adjust as necessary)
var allowedOrigins = configuration.GetSection("AllowedOrigins").Get<string[]>() ??
                     new[] { "http://localhost:5173", "http://localhost:3000" };
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Database (MySQL / Pomelo)
var connectionString = configuration.GetConnectionString("DefaultConnection")
                       ?? configuration["ConnectionStrings:Default"]
                       ?? "server=localhost;user=root;password=root;database=lostandfounddb";
// Configure database provider. Use MySQL in non-testing environments, and a
// lightweight SQLite file for the `Testing` environment so the hosted app in CI
// can serve test requests without requiring a MySQL server.
if (builder.Environment.IsEnvironment("Testing"))
{
    var sqliteFile = Path.Combine(builder.Environment.ContentRootPath, "lostandfound_tests.db");
    var sqliteConn = $"Data Source={sqliteFile}";
    builder.Services.AddDbContext<AppDbContext>(options =>
    {
        options.UseSqlite(sqliteConn);
    });
}
else
{
    // During integration tests (external test projects) they may register a
    // different provider; but for normal runs use MySQL by default.
    builder.Services.AddDbContext<AppDbContext>(options =>
    {
        // ServerVersion.AutoDetect will inspect the connection; it's convenient for local/dev
        options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
    });
}

// SignalR (server-side)
builder.Services.AddSignalR();

// Cache and HTTP client for avatar proxying
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();

// JWT Authentication setup
var jwtKey = configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
{
    if (builder.Environment.IsEnvironment("Testing"))
    {
        // Provide a deterministic test key for integration tests so startup doesn't fail.
        jwtKey = "TestSecretKey_DoNotUse_InProduction_ChangeThis";
        builder.Configuration["Jwt:Key"] = jwtKey;
    }
    else
    {
        // Fail early in dev if you forgot to set the secret; in production prefer a vault
        throw new InvalidOperationException("Jwt:Key is not configured. Set it using user-secrets or environment variables.");
    }
}

var jwtIssuer = configuration["Jwt:Issuer"] ?? "LostAndFoundApp";
var jwtAudience = configuration["Jwt:Audience"] ?? "LostAndFoundAppAudience";
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = true;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(2),
        RoleClaimType = ClaimTypes.Role
    };

    // Allow JWT to be passed via query string for SignalR (access_token)
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"].FirstOrDefault();
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// If running in the Testing environment, ensure the SQLite database exists and
// apply migrations so the `TestController` and other controllers can operate.
if (app.Environment.IsEnvironment("Testing"))
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        try
        {
            // Try applying migrations first (preferred). If the model has
            // pending changes (common during active development), fall back
            // to EnsureCreated so the SQLite database used in CI has the
            // current schema without requiring a new migration file.
            db.Database.Migrate();
            app.Logger.LogInformation("Applied migrations for Testing environment (SQLite).");
        }
        catch (InvalidOperationException innerEx)
        {
            app.Logger.LogWarning(innerEx, "Migrations could not be applied (possible pending model changes). Falling back to EnsureCreated().");
            db.Database.EnsureCreated();
            app.Logger.LogInformation("Ensured database created for Testing environment (SQLite).");
        }
        catch (Exception innerEx)
        {
            app.Logger.LogWarning(innerEx, "Failed to apply migrations; attempting EnsureCreated() as fallback for Testing.");
            try
            {
                db.Database.EnsureCreated();
                app.Logger.LogInformation("Ensured database created for Testing environment (SQLite) after migration failure.");
            }
            catch (Exception ensureEx)
            {
                app.Logger.LogError(ensureEx, "EnsureCreated() also failed for Testing environment.");
            }
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to prepare database for Testing environment.");
    }
}

// --- Middleware pipeline ---
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        // Ensure popups can postMessage back to this window (useful for GSI popup/OneTap)
        context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";

        // Make sure we don't set a strict COEP that would block cross-origin resources.
        // If something else set COEP, you can remove it for dev (leave absent in production).
        context.Response.Headers.Remove("Cross-Origin-Embedder-Policy");

        await next();
    });
    // Enable Swagger UI in development for easy API testing
    try
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "LostAndFoundApp API V1");
            c.RoutePrefix = "swagger"; // serve at /swagger
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed to enable Swagger UI");
    }
}

// In the Testing environment we host on plain HTTP in CI. Avoid forcing
// HTTPS redirection there because the runner does not configure HTTPS endpoints
// and the redirect would cause POSTs to receive 3xx responses instead of 200.
if (!app.Environment.IsEnvironment("Testing"))
{
    app.UseHttpsRedirection();
}

app.UseCors();

app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// Ensure uploads directory exists on startup. Prefer configured Uploads:RootPath, otherwise use webroot/wwwroot.
try
{
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "Failed to ensure uploads directory exists on startup");
}
// Resolve and ensure uploads directory exists on startup. Prefer configured Uploads:RootPath,
// otherwise default to the user's Pictures folder requested during development.
try
{
    var configured = app.Configuration["Uploads:RootPath"];
    string uploadsRoot;
    if (!string.IsNullOrWhiteSpace(configured))
    {
        uploadsRoot = configured!;
    }
    else
    {
        // Default uploads path requested by the developer
        uploadsRoot = @"C:\Users\admin\Pictures\VsCodeImages";
        app.Logger.LogInformation("Uploads:RootPath not configured. Defaulting uploads root to {UploadsRoot}", uploadsRoot);
    }

    var uploadsItems = Path.Combine(uploadsRoot, "uploads", "items");
    Directory.CreateDirectory(uploadsItems);
    app.Logger.LogInformation("Ensured uploads directory exists: {UploadsItems}", uploadsItems);

    // Serve files from the resolved uploads root's "uploads" subfolder at request path /uploads
    var uploadsFolderToServe = Path.Combine(uploadsRoot, "uploads");
    if (Directory.Exists(uploadsFolderToServe))
    {
        var provider = new PhysicalFileProvider(uploadsFolderToServe);
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = provider,
            RequestPath = "/uploads",
        });
        app.Logger.LogInformation("Serving uploads from {UploadsFolder} at /uploads", uploadsFolderToServe);
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Could not configure static file serving or create uploads directory");
}

app.MapControllers();

app.MapHub<LostAndFoundApp.Hubs.MessagingHub>("/hubs/messages");

// Lightweight health endpoint used by CI to verify the server is responding.
// Returns 200 OK with a small JSON payload.
app.MapGet("/health", () => Results.Json(new { status = "ok" }));

app.Run();

// Expose Program type for integration tests (WebApplicationFactory<Program> requires a public Program class)
public partial class Program { }