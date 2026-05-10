module.exports = (sequelize, DataTypes) => {
  const NewsShare = sequelize.define('NewsShare', {
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
    channel: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    view_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'news_share',
    updatedAt: false,
  });

  NewsShare.associate = (models) => {
    NewsShare.belongsTo(models.NewsItem, { foreignKey: 'news_item_id', as: 'article' });
    NewsShare.belongsTo(models.UserAccount, { foreignKey: 'user_id', as: 'user' });
  };

  return NewsShare;
};
