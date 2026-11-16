using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace CompanySystem.Api.Services;

/// <summary>
/// Changes that must take turns (every stock change, every change to who is an
/// administrator) start by taking one named SQL Server app lock inside a
/// transaction, held until the transaction ends. Readers aren't blocked; a
/// second writer waits, then sees what the first one left.
/// </summary>
public static class AppLock
{
    /// <summary>
    /// Opens a transaction and takes the lock named <paramref name="resource"/>.
    /// Waits up to 15 s; after that, throws <see cref="BusyException"/> with
    /// <paramref name="busyMessage"/>, which BusyFilter turns into a 409.
    /// </summary>
    public static async Task<IDbContextTransaction> Take(DbContext db, string resource, string busyMessage)
    {
        var tx = await db.Database.BeginTransactionAsync();
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                DECLARE @result int;
                EXEC @result = sp_getapplock @Resource = {0}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
                IF @result < 0 THROW 50000, 'busy', 1;
                """, resource);
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number == 50000)
        {
            await tx.DisposeAsync();
            throw new BusyException(busyMessage);
        }
        return tx;
    }
}

/// <summary>
/// Thrown when a lock (see <see cref="AppLock"/>) couldn't be taken in time:
/// another change held it for too long. Nothing is wrong with the data — the
/// change just needs to be tried again.
/// </summary>
public class BusyException(string message) : Exception(message);

/// <summary>
/// Turns a BusyException into a 409 with a friendly message, instead of the
/// 500 an unhandled exception would give. Registered for every controller in Program.cs.
/// </summary>
public class BusyFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not BusyException busy) return;
        context.Result = new ConflictObjectResult(new { message = busy.Message });
        context.ExceptionHandled = true;
    }
}
