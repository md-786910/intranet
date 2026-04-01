module.exports = (sequelize, DataTypes) => {
  const SavedItem = sequelize.define('SavedItem', {
    saved_item_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'saved_item',
  });

  SavedItem.associate = (models) => {
    SavedItem.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return SavedItem;
};
