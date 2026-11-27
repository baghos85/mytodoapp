using Microsoft.AspNetCore.Identity;

namespace MyTodoApp.Infrastructure.Identity;

/// <summary>
/// The Identity user (SPEC 3.1), table <c>AspNetUsers</c>. No custom profile fields in v1. Lives in Infrastructure
/// because Domain must not reference Identity; domain entities refer to it by <c>UserId</c> only.
/// Saving a new <see cref="User"/> also creates its Inbox (see <c>AppDbContext</c>).
/// </summary>
public sealed class User : IdentityUser<Guid>
{
    public User()
    {
        Id = Guid.CreateVersion7();
    }
}
