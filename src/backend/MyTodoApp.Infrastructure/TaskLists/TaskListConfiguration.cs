using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyTodoApp.Domain.TaskLists;
using MyTodoApp.Infrastructure.Identity;

namespace MyTodoApp.Infrastructure.TaskLists;

/// <summary>Table <c>TaskLists</c>: columns per SPEC 3.2, indexes and delete behaviour per SPEC 10.4.</summary>
internal sealed class TaskListConfiguration : IEntityTypeConfiguration<TaskList>
{
    /// <summary>Unique <c>(UserId, Name)</c>; case-insensitive through the database's default collation.</summary>
    public const string UniqueNameIndex = "IX_TaskLists_UserId_Name";

    /// <summary>Unique <c>(UserId) WHERE IsDefault = 1</c>: at most one Inbox per user.</summary>
    public const string UniqueInboxIndex = "IX_TaskLists_UserId_Default";

    public void Configure(EntityTypeBuilder<TaskList> builder)
    {
        builder.ToTable("TaskLists");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).HasMaxLength(TaskList.NameMaxLength);

        builder.HasIndex(x => new { x.UserId, x.Name })
            .IsUnique()
            .HasDatabaseName(UniqueNameIndex);

        builder.HasIndex(x => x.UserId)
            .IsUnique()
            .HasFilter("[IsDefault] = 1")
            .HasDatabaseName(UniqueInboxIndex);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
