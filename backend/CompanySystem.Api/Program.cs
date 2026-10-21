using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ---- Database (EF Core + SQL Server) ----
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---- Auth services ----
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// ---- File storage (uploaded documents) ----
builder.Services.AddSingleton<CompanySystem.Api.Services.FileStorage>();

// ---- Stock (where material is, and moving it) ----
builder.Services.AddScoped<CompanySystem.Api.Services.StockService>();

var jwt = builder.Configuration.GetSection("Jwt");
// Read the key now, so a missing secret stops the API at start-up, not at the first sign-in.
var signingKey = JwtTokenService.SigningKey(builder.Configuration);
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = signingKey,
        };
        options.Events = new JwtBearerEvents
        {
            // A token is only as good as the account behind it. On every request,
            // check the login still exists, may still be used, and still has the
            // role the token claims — so a switched-off or demoted account stops
            // working at once, not when its token runs out hours later.
            OnTokenValidated = async ctx =>
            {
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var id = int.TryParse(ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : 0;
                var role = ctx.Principal?.FindFirstValue(ClaimTypes.Role);
                if (!await AccountRules.UsableLogins(db).AnyAsync(u => u.Id == id && u.Role == role))
                    ctx.Fail("This account was changed or switched off. Please sign in again.");
            },
        };
    });
// Every endpoint needs a signed-in user unless it says [AllowAnonymous] — so a
// new controller that forgets [Authorize] is still protected.
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        // Always send timestamps as UTC (with a 'Z'), so the browser shows
        // correct local times and "x minutes ago" values.
        options.JsonSerializerOptions.Converters.Add(new CompanySystem.Api.Json.UtcDateTimeConverter());
    });
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// ---- Apply migrations + seed the admin on startup ----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

// ---- HTTP pipeline ----
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// Only force HTTPS in production. In development this lets the React dev
// proxy talk to the plain HTTP endpoint without redirect issues.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication(); // who are you? (reads the token)
app.UseAuthorization();  // are you allowed? (checks roles)

app.MapControllers();

app.Run();

// Lets the test project start the real app (WebApplicationFactory<Program>).
public partial class Program;
