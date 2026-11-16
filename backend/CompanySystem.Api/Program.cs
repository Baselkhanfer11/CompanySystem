using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
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
            // check the login still exists, may still be used, still has the role
            // the token claims, and still has the password the token was issued
            // under — so a switched-off or demoted account, or a sign-in made
            // before a password change, stops working at once, not when its token
            // runs out hours later.
            OnTokenValidated = async ctx =>
            {
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var id = int.TryParse(ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : 0;
                var role = ctx.Principal?.FindFirstValue(ClaimTypes.Role);
                var passwordVersion = ctx.Principal?.FindFirstValue(JwtTokenService.PasswordVersionClaim);
                var passwordHash = await AccountRules.UsableLogins(db)
                    .Where(u => u.Id == id && u.Role == role)
                    .Select(u => u.PasswordHash)
                    .FirstOrDefaultAsync();
                if (passwordHash is null || JwtTokenService.PasswordVersion(passwordHash) != passwordVersion)
                    ctx.Fail("This account was changed or switched off. Please sign in again.");
            },
        };
    });

// Sign-in attempts are limited per address, so a password can't be guessed by
// trying thousands. The limit is a setting so the tests can lift it.
var loginAttemptsPerMinute = builder.Configuration.GetValue("RateLimits:LoginPerMinute", 20);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, cancel) =>
    {
        ctx.HttpContext.Response.ContentType = "application/json";
        await ctx.HttpContext.Response.WriteAsync(
            """{"message":"Too many sign-in attempts. Please wait a minute and try again."}""", cancel);
    };
    options.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = loginAttemptsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});
// Every endpoint needs a signed-in user unless it says [AllowAnonymous] — so a
// new controller that forgets [Authorize] is still protected.
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

builder.Services
    // A stock change that couldn't get its turn is a 409 "try again", not a 500.
    .AddControllers(options => options.Filters.Add<CompanySystem.Api.Services.StockBusyFilter>())
    .AddJsonOptions(options =>
    {
        // Money fields are left out for people who may not see them (see Json/MoneyVisibility.cs).
        options.JsonSerializerOptions.TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver
        {
            Modifiers = { CompanySystem.Api.Json.MoneyVisibility.HideMoney },
        };
        // Always send timestamps as UTC (with a 'Z'), so the browser shows
        // correct local times and "x minutes ago" values.
        options.JsonSerializerOptions.Converters.Add(new CompanySystem.Api.Json.UtcDateTimeConverter());
    });
// Lets MoneyVisibility see who the current request is for.
builder.Services.AddHttpContextAccessor();
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

app.UseRateLimiter();    // too many sign-in attempts? (see the "login" policy above)
app.UseAuthentication(); // who are you? (reads the token)
app.UseAuthorization();  // are you allowed? (checks roles)

app.MapControllers();

app.Run();

// Lets the test project start the real app (WebApplicationFactory<Program>).
public partial class Program;
