using Microsoft.EntityFrameworkCore;
using LostAndFoundApp.Models;

namespace LostAndFoundApp.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Role> Roles { get; set; } = null!;
        public DbSet<Item> Items { get; set; } = null!;
        public DbSet<Category> Categories { get; set; } = null!;
        public DbSet<ItemType> ItemTypes { get; set; } = null!;
        public DbSet<Status> Statuses { get; set; } = null!;
        public DbSet<Message> Messages { get; set; } = null!;
        public DbSet<ItemImage> ItemImages { get; set; }
        public DbSet<ItemMatch> ItemMatches { get; set; }

        public DbSet<Notification> Notifications { get; set; } = null!;
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>().HasIndex(u => u.GoogleId).IsUnique(false); // set true if you require GoogleId to be unique
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique(false); // set true if you require emails to be unique
            modelBuilder.Entity<User>()
                .HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();

            modelBuilder.Entity<Item>().HasOne(i => i.User)
                .WithMany()
                .HasForeignKey(i => i.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Item>()
                .HasOne(i => i.Category)
                .WithMany()
                .HasForeignKey(i => i.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Item>()
                .HasOne(i => i.Type)
                .WithMany()
                .HasForeignKey(i => i.TypeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Item>()
                .HasOne(i => i.Status)
                .WithMany()
                .HasForeignKey(i => i.StatusId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ItemImage>()
                .HasOne(i => i.Item)
                .WithMany(it => it.Images)
                .HasForeignKey(i => i.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ItemMatch>()
                .HasOne(m => m.LostItem)
                .WithMany()
                .HasForeignKey(m => m.LostItemId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ItemMatch>()
                .HasOne(m => m.FoundItem)
                .WithMany()
                .HasForeignKey(m => m.FoundItemId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Category>().HasIndex(c => c.Name).IsUnique();
            modelBuilder.Entity<ItemType>().HasIndex(i => i.Name).IsUnique();
            modelBuilder.Entity<Status>().HasIndex(s => s.Name).IsUnique();

            base.OnModelCreating(modelBuilder);

            // global filter: exclude soft-deleted by default
            modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);
            modelBuilder.Entity<Item>().HasQueryFilter(i => !i.IsDeleted);

            // indexes to help admin queries
            modelBuilder.Entity<User>().HasIndex(u => u.IsDeleted);
            modelBuilder.Entity<User>().HasIndex(u => u.DeletedAt);
            modelBuilder.Entity<Item>().HasIndex(i => i.IsDeleted);
            modelBuilder.Entity<Item>().HasIndex(i => i.DeletedAt);
            modelBuilder.Entity<Item>().HasIndex(i => i.UserId);
            modelBuilder.Entity<Item>().HasIndex(i => i.CategoryId);
            modelBuilder.Entity<Message>().HasIndex(m => new { m.ReceiverId, m.IsRead });
            modelBuilder.Entity<Message>().HasIndex(m => new { m.SenderId, m.CreatedAt });
            modelBuilder.Entity<Message>().HasIndex(m => new { m.ReceiverId, m.IsRead });
            modelBuilder.Entity<ItemMatch>().HasIndex(m => new { m.LostItemId });
            modelBuilder.Entity<ItemMatch>().HasIndex(m => new { m.FoundItemId });
            modelBuilder.Entity<Message>().HasIndex(m => new { m.SenderId, m.CreatedAt });

            // Use static timestamps in seeding to avoid dynamic model changes at build time
            var seedTimestamp = new DateTime(2025, 01, 01, 0, 0, 0, DateTimeKind.Utc);

            modelBuilder.Entity<Role>().HasData(
                new Role { RoleId = 1, Name = "User", Description = "Default user role", IsActive = true, CreatedAt = seedTimestamp },
                new Role { RoleId = 2, Name = "Admin", Description = "Administrator", IsActive = true, CreatedAt = seedTimestamp },
                new Role { RoleId = 3, Name = "Moderator", Description = "Moderator", IsActive = true, CreatedAt = seedTimestamp }
            );

            modelBuilder.Entity<ItemType>().HasData(
                new ItemType { Id = 1, Name = "Lost", Description = "Item that was lost", CreatedAt = seedTimestamp },
                new ItemType { Id = 2, Name = "Found", Description = "Item that was found", CreatedAt = seedTimestamp }
            );

            modelBuilder.Entity<Status>().HasData(
                new Status { Id = 1, Name = "Pending", Description = "Awaiting review", CreatedAt = seedTimestamp },
                new Status { Id = 2, Name = "Active", Description = "Currently active", CreatedAt = seedTimestamp },
                new Status { Id = 3, Name = "Claimed", Description = "Item claimed", CreatedAt = seedTimestamp },
                new Status { Id = 4, Name = "Closed", Description = "Case closed", CreatedAt = seedTimestamp }
            );

            modelBuilder.Entity<Category>().HasData(
                new Category { Id = 2, Name = "Personal Items", Description = "Wallets, keys, bags", CreatedAt = seedTimestamp },
                new Category { Id = 3, Name = "Clothing", Description = "Apparel and accessories", CreatedAt = seedTimestamp },
                new Category { Id = 4, Name = "Documents", Description = "IDs, papers", CreatedAt = seedTimestamp },
                new Category { Id = 5, Name = "Other", Description = "Miscellaneous", CreatedAt = seedTimestamp },
                new Category { Id = 6, Name = "Electronics", Description = "Devices and accessories", CreatedAt = seedTimestamp }
            );
        }
    }
}