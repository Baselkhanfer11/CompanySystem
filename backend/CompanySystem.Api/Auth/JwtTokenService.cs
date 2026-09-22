using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CompanySystem.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace CompanySystem.Api.Auth;

/// <summary>
/// Creates signed JWT tokens for logged-in users.
/// The signing key + settings come from appsettings.json ("Jwt" section).
/// </summary>
public class JwtTokenService(IConfiguration config)
{
    public (string token, DateTime expiresAt) Create(User user)
    {
        var jwt = config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
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
