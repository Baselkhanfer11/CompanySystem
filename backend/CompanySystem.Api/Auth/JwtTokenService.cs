using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CompanySystem.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace CompanySystem.Api.Auth;

/// <summary>
/// Creates signed JWT tokens for logged-in users.
/// Settings come from appsettings.json ("Jwt" section); the signing key is a secret
/// (dotnet user-secrets locally) and is never in git.
/// </summary>
public class JwtTokenService(IConfiguration config)
{
    /// <summary>The key that signs and checks tokens. Stops with a clear message if it isn't set.</summary>
    public static SymmetricSecurityKey SigningKey(IConfiguration config)
    {
        var key = config["Jwt:Key"];
        // HMAC-SHA256 needs at least 256 bits (32 bytes).
        if (string.IsNullOrEmpty(key) || Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException(
                "Jwt:Key is missing or shorter than 32 characters. Set it with dotnet user-secrets " +
                "inside backend/CompanySystem.Api (see the README).");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    /// <summary>
    /// The name of the claim that ties a token to the password it was issued under.
    /// </summary>
    public const string PasswordVersionClaim = "pwv";

    /// <summary>
    /// A short fingerprint of the stored password hash. It changes whenever the
    /// password does (every hash has a fresh salt), so a token issued under the old
    /// password can be told apart on every request — see Program.cs. It reveals
    /// nothing about the password: it's a one-way hash of a one-way hash.
    /// </summary>
    public static string PasswordVersion(string passwordHash) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(passwordHash)))[..16];

    public (string token, DateTime expiresAt) Create(User user)
    {
        var jwt = config.GetSection("Jwt");
        var creds = new SigningCredentials(SigningKey(config), SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(int.Parse(jwt["ExpiryMinutes"] ?? "480"));

        // Claims = the facts baked into the token.
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("fullName", user.FullName),
            new Claim(PasswordVersionClaim, PasswordVersion(user.PasswordHash)),
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
