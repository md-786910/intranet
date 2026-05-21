module.exports = (sequelize, DataTypes) => {
  const NewsComment = sequelize.define('NewsComment', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    news_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'news_comment',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: {},
    },
  });

  NewsComment.associate = (models) => {
    NewsComment.belongsTo(models.NewsItem, { foreignKey: 'news_item_id', as: 'article' });
    NewsComment.belongsTo(models.UserAccount, { foreignKey: 'user_id', as: 'author' });
  };

  return NewsComment;
};
