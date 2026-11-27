using MyTodoApp.Domain.Common;

namespace MyTodoApp.Domain.UnitTests.Common;

public sealed class DomainExceptionTests
{
    [Fact]
    public void NotFoundException_Created_IsDomainExceptionWithMessage()
    {
        var exception = new NotFoundException("List not found.");

        Assert.IsAssignableFrom<DomainException>(exception);
        Assert.Equal("List not found.", exception.Message);
    }

    [Fact]
    public void ConflictException_Created_IsDomainExceptionWithMessage()
    {
        var exception = new ConflictException("A list with this name already exists.");

        Assert.IsAssignableFrom<DomainException>(exception);
        Assert.Equal("A list with this name already exists.", exception.Message);
    }

    [Fact]
    public void ForbiddenException_Created_IsDomainExceptionWithMessage()
    {
        var exception = new ForbiddenException("Not allowed.");

        Assert.IsAssignableFrom<DomainException>(exception);
        Assert.Equal("Not allowed.", exception.Message);
    }

    [Fact]
    public void DomainValidationException_Created_CarriesFieldAndMessage()
    {
        var exception = new DomainValidationException("password", "Incorrect password.");

        Assert.IsAssignableFrom<DomainException>(exception);
        Assert.Equal("password", exception.Field);
        Assert.Equal("Incorrect password.", exception.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void DomainValidationException_BlankField_ThrowsArgumentException(string field)
    {
        Assert.Throws<ArgumentException>(() => new DomainValidationException(field, "Invalid."));
    }

    [Fact]
    public void DomainValidationException_NullField_ThrowsArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new DomainValidationException(null!, "Invalid."));
    }
}
