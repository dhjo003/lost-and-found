using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using LostAndFoundApp.Models;
using Microsoft.AspNetCore.Authorization;

[Route("api/items/{itemId}/images")]
[ApiController]
[Authorize]
public class ItemImagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ItemImagesController> _logger;
    private readonly IConfiguration _config;

    public ItemImagesController(AppDbContext db, IWebHostEnvironment env, ILogger<ItemImagesController> logger, IConfiguration config)
    {
        _db = db;
        _env = env;
        _logger = logger;
        _config = config;
    }

    // Resolve base uploads root (consistent for all methods)
    private string ResolveBaseUploadsRoot()
    {
        try
        {
            var cfg = _config?["Uploads:RootPath"];
            if (!string.IsNullOrWhiteSpace(cfg)) return cfg!;
        }
        catch { }

        var webRoot = !string.IsNullOrWhiteSpace(_env.WebRootPath)
            ? _env.WebRootPath!
            : Path.Combine(_env.ContentRootPath ?? Directory.GetCurrentDirectory(), "wwwroot");
        return webRoot;
    }

    // GET all images for item
    [HttpGet]
    public async Task<IActionResult> GetImages(int itemId)
    {
        var imgs = await _db.ItemImages.Where(i => i.ItemId == itemId).OrderByDescending(i => i.IsPrimary).ThenBy(i => i.CreatedAt).ToListAsync();
        var baseAddress = $"{Request.Scheme}://{Request.Host}";
        var result = imgs.Select(i => new {
            i.Id,
            i.FileName,
            Url = baseAddress + (i.Url ?? string.Empty),
            i.IsPrimary,
            i.CreatedAt
        }).ToList();
        return Ok(result);
    }

    // POST upload images (allow multiple files)
    [HttpPost]
    public async Task<IActionResult> UploadImages(int itemId, [FromForm] List<IFormFile> files)
    {
        try
        {
            if (files == null || files.Count == 0) return BadRequest("No files uploaded");

            var item = await _db.Items.FindAsync(itemId);
            if (item == null) return NotFound();

            // Resolve uploads directory. Prefer explicit configuration (Uploads:RootPath), otherwise use webroot/wwwroot.
            string? baseUploadsRoot = null;
            try
            {
                baseUploadsRoot = _config?["Uploads:RootPath"];
            }
            catch { /* ignore config read errors */ }

            if (string.IsNullOrWhiteSpace(baseUploadsRoot))
            {
                var webRoot = !string.IsNullOrWhiteSpace(_env.WebRootPath)
                    ? _env.WebRootPath!
                    : Path.Combine(_env.ContentRootPath ?? Directory.GetCurrentDirectory(), "wwwroot");
                baseUploadsRoot = webRoot;
            }

            var uploadsRoot = Path.Combine(baseUploadsRoot, "uploads", "items", itemId.ToString());

            try
            {
                _logger.LogInformation("Ensuring uploads directory exists: {UploadsRoot}", uploadsRoot);
                Directory.CreateDirectory(uploadsRoot);
            }
            catch (Exception dirEx)
            {
                _logger.LogError(dirEx, "Failed to create uploads directory {UploadsRoot}", uploadsRoot);
                // In development try a temp fallback; otherwise return a clear error for the operator.
                if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")?.ToLowerInvariant() == "development")
                {
                    var tempRoot = Path.Combine(Path.GetTempPath(), "lostandfound_uploads", itemId.ToString());
                    try
                    {
                        Directory.CreateDirectory(tempRoot);
                        uploadsRoot = tempRoot;
                        _logger.LogInformation("Falling back to temp uploads path {TempRoot}", tempRoot);
                    }
                    catch (Exception tempEx)
                    {
                        _logger.LogError(tempEx, "Fallback temp uploads directory creation failed");
                        return StatusCode(500, new { error = "Failed to create uploads directory; check file permissions." });
                    }
                }
                else
                {
                    return StatusCode(500, new { error = "Failed to create uploads directory; check file permissions or configure Uploads:RootPath." });
                }
            }

            // Check if already has a primary
            var hasPrimary = await _db.ItemImages.AnyAsync(i => i.ItemId == itemId && i.IsPrimary);

            var added = new List<ItemImage>();

            foreach (var file in files)
            {
                // validate content type/size (example)
                if (file.Length <= 0) continue;
                var ext = Path.GetExtension(file.FileName);
                var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
                if (!allowed.Contains(ext.ToLower())) continue;

                // create unique filename
                var fileName = $"{Guid.NewGuid()}{ext}";
                var filePath = Path.Combine(uploadsRoot, fileName);

                _logger.LogInformation("Saving uploaded file to {FilePath}", filePath);
                using (var stream = System.IO.File.Create(filePath))
                {
                    await file.CopyToAsync(stream);
                }

                var url = $"/uploads/items/{itemId}/{fileName}";

                var img = new ItemImage
                {
                    ItemId = itemId,
                    FileName = fileName,
                    Url = url,
                    IsPrimary = !hasPrimary && added.Count == 0 // first uploaded file becomes primary if none exists
                };

                _db.ItemImages.Add(img);
                added.Add(img);
            }

            await _db.SaveChangesAsync();

            // return created images (including Ids) as lightweight DTOs to avoid navigation cycles
            // Build absolute URLs for the response so the frontend can load images directly
            var baseAddress = $"{Request.Scheme}://{Request.Host}";
            var result = added.Select(a => new {
                a.Id,
                a.FileName,
                Url = baseAddress + (a.Url ?? string.Empty),
                a.IsPrimary,
                a.CreatedAt
            }).ToList();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UploadImages failed for item {ItemId}", itemId);
            // In Development return full exception details to help debugging. In production avoid leaking internals.
            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")?.ToLowerInvariant() == "development")
            {
                return StatusCode(500, new { error = ex.Message, details = ex.ToString() });
            }
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // DELETE image
    [HttpDelete("{imageId}")]
    public async Task<IActionResult> DeleteImage(int itemId, int imageId)
    {
        var img = await _db.ItemImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ItemId == itemId);
        if (img == null) return NotFound();

        // delete file from disk
        try
        {
            var baseUploadsRoot = ResolveBaseUploadsRoot();
            var filePath = Path.Combine(baseUploadsRoot, "uploads", "items", itemId.ToString(), img.FileName);
            if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete image file for image {ImageId}", imageId);
        }

        var wasPrimary = img.IsPrimary;

        _db.ItemImages.Remove(img);
        await _db.SaveChangesAsync();

        // If removed image was primary, set another as primary (if any left)
        if (wasPrimary)
        {
            var next = await _db.ItemImages.Where(i => i.ItemId == itemId).OrderBy(i => i.CreatedAt).FirstOrDefaultAsync();
            if (next != null)
            {
                next.IsPrimary = true;
                await _db.SaveChangesAsync();
            }
        }

        return NoContent();
    }

    // POST set primary
    [HttpPost("{imageId}/set-primary")]
    public async Task<IActionResult> SetPrimary(int itemId, int imageId)
    {
        var img = await _db.ItemImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ItemId == itemId);
        if (img == null) return NotFound();

        // Unset existing primary(s)
        var existing = await _db.ItemImages.Where(i => i.ItemId == itemId && i.IsPrimary).ToListAsync();
        foreach (var e in existing)
        {
            e.IsPrimary = false;
        }

        img.IsPrimary = true;
        await _db.SaveChangesAsync();

        return Ok(img);
    }

    // --- Temporary upload endpoints ---
    // POST /api/items/temp-images
    [HttpPost]
    [Route("/api/items/temp-images")]
    public async Task<IActionResult> UploadTempImages([FromForm] List<IFormFile> files)
    {
        try
        {
            if (files == null || files.Count == 0) return BadRequest("No files uploaded");

            var baseUploadsRoot = ResolveBaseUploadsRoot();
            var tempId = Guid.NewGuid().ToString();
            var tempFolder = Path.Combine(baseUploadsRoot, "uploads", "temp", tempId);
            Directory.CreateDirectory(tempFolder);

            var added = new List<object>();
            foreach (var file in files)
            {
                if (file.Length <= 0) continue;
                var ext = Path.GetExtension(file.FileName);
                var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
                if (!allowed.Contains(ext.ToLower())) continue;

                var fileName = $"{Guid.NewGuid()}{ext}";
                var filePath = Path.Combine(tempFolder, fileName);
                using (var stream = System.IO.File.Create(filePath))
                {
                    await file.CopyToAsync(stream);
                }

                var url = $"/uploads/temp/{tempId}/{fileName}";
                added.Add(new { fileName, url });
            }

            return Ok(new { tempId, files = added });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UploadTempImages failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // POST /api/items/{itemId}/images/attach-temp/{tempId}
    [HttpPost]
    [Route("/api/items/{itemId}/images/attach-temp/{tempId}")]
    public async Task<IActionResult> AttachTempToItem(int itemId, string tempId)
    {
        try
        {
            var item = await _db.Items.FindAsync(itemId);
            if (item == null) return NotFound();

            var baseUploadsRoot = ResolveBaseUploadsRoot();
            var tempFolder = Path.Combine(baseUploadsRoot, "uploads", "temp", tempId);
            if (!Directory.Exists(tempFolder)) return NotFound(new { error = "Temp upload not found" });

            var destFolder = Path.Combine(baseUploadsRoot, "uploads", "items", itemId.ToString());
            Directory.CreateDirectory(destFolder);

            var files = Directory.GetFiles(tempFolder);
            var hasPrimary = await _db.ItemImages.AnyAsync(i => i.ItemId == itemId && i.IsPrimary);
            var added = new List<ItemImage>();

            foreach (var f in files)
            {
                var fileName = Path.GetFileName(f);
                var destPath = Path.Combine(destFolder, fileName);
                if (System.IO.File.Exists(destPath))
                {
                    // skip or overwrite; choose overwrite
                    System.IO.File.Delete(destPath);
                }
                System.IO.File.Move(f, destPath);

                var url = $"/uploads/items/{itemId}/{fileName}";
                var img = new ItemImage
                {
                    ItemId = itemId,
                    FileName = fileName,
                    Url = url,
                    IsPrimary = !hasPrimary && added.Count == 0
                };
                _db.ItemImages.Add(img);
                added.Add(img);
            }

            await _db.SaveChangesAsync();

            // remove temp folder
            try { Directory.Delete(tempFolder, true); } catch { }

            var baseAddress = $"{Request.Scheme}://{Request.Host}";
            var result = added.Select(a => new { a.Id, a.FileName, Url = baseAddress + (a.Url ?? string.Empty), a.IsPrimary, a.CreatedAt }).ToList();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AttachTempToItem failed for tempId {TempId}", tempId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // DELETE /api/items/temp-images/{tempId}
    [HttpDelete]
    [Route("/api/items/temp-images/{tempId}")]
    public IActionResult DeleteTempUploads(string tempId)
    {
        try
        {
            var baseUploadsRoot = ResolveBaseUploadsRoot();
            var tempFolder = Path.Combine(baseUploadsRoot, "uploads", "temp", tempId);
            if (Directory.Exists(tempFolder))
            {
                Directory.Delete(tempFolder, true);
                return NoContent();
            }
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DeleteTempUploads failed for {TempId}", tempId);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}