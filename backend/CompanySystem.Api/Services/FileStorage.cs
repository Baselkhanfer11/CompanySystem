namespace CompanySystem.Api.Services;

/// <summary>
/// Saves uploaded files to a local folder on disk (Storage/uploads under the
/// app's content root) and reads them back. One company on one server doesn't
/// need cloud storage; if that ever changes, only this class is swapped out.
/// </summary>
public class FileStorage
{
    private readonly string _root;

    public FileStorage(IWebHostEnvironment env)
    {
        _root = Path.Combine(env.ContentRootPath, "Storage", "uploads");
    }

    /// <summary>Saves the uploaded file under a new unique name and returns that name.</summary>
    public async Task<string> SaveAsync(IFormFile file)
    {
        Directory.CreateDirectory(_root);
        var storedName = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        var fullPath = Path.Combine(_root, storedName);

        await using var stream = File.Create(fullPath);
        await file.CopyToAsync(stream);

        return storedName;
    }

    /// <summary>The absolute path of a stored file.</summary>
    public string PathFor(string storedName) => Path.Combine(_root, storedName);

    /// <summary>Opens a stored file for reading, or null if it's missing.</summary>
    public Stream? OpenRead(string storedName)
    {
        var fullPath = PathFor(storedName);
        return File.Exists(fullPath) ? File.OpenRead(fullPath) : null;
    }

    /// <summary>Deletes a stored file if it exists (used when a document is removed).</summary>
    public void Delete(string storedName)
    {
        var fullPath = PathFor(storedName);
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }
}
