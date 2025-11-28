using System.Threading.Tasks;
using Xunit;
using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Data;
using FluentAssertions;

namespace LostAndFoundApp.Tests.Unit
{
    public class ItemServiceTests
    {
        [Fact]
        public async Task InMemoryDb_CanAddAndReadItem()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: "unit-test-db")
                .Options;

            using (var ctx = new AppDbContext(options))
            {
                ctx.Items.Add(new Models.Item { Name = "UnitItem" });
                await ctx.SaveChangesAsync();
            }

            using (var ctx = new AppDbContext(options))
            {
                var item = await ctx.Items.FirstOrDefaultAsync(i => i.Name == "UnitItem");
                item.Should().NotBeNull();
                item!.Name.Should().Be("UnitItem");
            }
        }
    }
}
