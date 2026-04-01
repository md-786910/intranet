module.exports = (sequelize, DataTypes) => {
  const NewsAttachment = sequelize.define('NewsAttachment', {
    news_attachment_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    news_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    media_asset_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'news_attachment',
  });

  NewsAttachment.associate = (models) => {
    NewsAttachment.belongsTo(models.NewsItem, {
      foreignKey: 'news_item_id',
      as: 'newsItem',
    });
    NewsAttachment.belongsTo(models.MediaAsset, {
      foreignKey: 'media_asset_id',
      as: 'mediaAsset',
    });
  };

  return NewsAttachment;
};
