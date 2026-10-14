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
