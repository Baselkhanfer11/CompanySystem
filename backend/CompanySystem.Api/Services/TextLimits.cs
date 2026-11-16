namespace CompanySystem.Api.Services;

/// <summary>
/// How long typed text may be. Used both on what the frontend sends (a
/// [MaxLength] on the request, so too-long text is a 400 with a message) and on
/// the database columns (the same [MaxLength] on the model), so a pasted novel
/// never ends up in a name field or breaks an index.
/// </summary>
public static class TextLimits
{
    public const int Name = 200;     // names, titles, usernames
    public const int Code = 50;      // item / project / supplier codes
    public const int Short = 100;    // positions, phone numbers, invoice numbers, statuses, file types
    public const int Email = 200;
    public const int Address = 500;
    public const int Notes = 2000;   // notes, descriptions, review notes
    public const int FileName = 260; // what the file system allows
    public const int Url = 500;
}
