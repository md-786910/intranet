module.exports = (sequelize, DataTypes) => {
  const NewsLike = sequelize.define('NewsLike', {
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
      allowNull: false,
    },
  }, {
    tableName: 'news_like',
    updatedAt: false,
  });

  NewsLike.associate = (models) => {
    NewsLike.belongsTo(models.NewsItem, { foreignKey: 'news_item_id', as: 'article' });
    NewsLike.belongsTo(models.UserAccount, { foreignKey: 'user_id', as: 'user' });
  };

  return NewsLike;
};
