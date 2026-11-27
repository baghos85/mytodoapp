using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyTodoApp.Domain.TaskLists;
using MyTodoApp.Domain.Tasks;
using MyTodoApp.Infrastructure.Identity;

namespace MyTodoApp.Infrastructure.Tasks;

/// <summary>Table <c>Tasks</c>: columns per SPEC 3.3, indexes and delete behaviour per SPEC 10.4.</summary>
internal sealed class TodoTaskConfiguration : IEntityTypeConfiguration<TodoTask>
{
    public void Configure(EntityTypeBuilder<TodoTask> builder)
    {
        builder.ToTable("Tasks");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Title).HasMaxLength(TodoTask.TitleMaxLength);
        builder.Property(x => x.Notes).HasMaxLength(TodoTask.NotesMaxLength);

        // Today / Upcoming.
        builder.HasIndex(x => new { x.UserId, x.IsCompleted, x.DueDate });
        // Completed view.
        builder.HasIndex(x => new { x.UserId, x.IsCompleted, x.CompletedAt });
        // List view and openTaskCount.
        builder.HasIndex(x => new { x.ListId, x.IsCompleted });

        // Deleting a list deletes its tasks.
        builder.HasOne<TaskList>()
            .WithMany()
            .HasForeignKey(x => x.ListId)
            .OnDelete(DeleteBehavior.Cascade);

        // Denormalised owner (ADR-015). No cascade: SQL Server rejects multiple cascade paths
        // (AspNetUsers -> TaskLists -> Tasks already cascades). Account deletion removes tasks explicitly.
        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
