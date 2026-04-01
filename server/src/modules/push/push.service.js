const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const pushService = {
  async list(query) {
    const { PushCampaign, UserAccount } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);

    const where = { deleted_at: null };
    if (query.status) where.status = query.status;

    const { rows, count } = await PushCampaign.findAndCountAll({
      where,
      limit,
      offset,
      include: [{
        model: UserAccount,
        as: 'creator',
        attributes: ['user_id', 'first_name', 'last_name', 'email'],
      }],
      order: [['created_at', 'DESC']],
    });

    return {
      campaigns: rows,
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
    const { PushCampaign, UserAccount, ContentAudienceRule, OrgUnit } = require('../../database/models');

    const campaign = await PushCampaign.findByPk(id, {
      include: [
        {
          model: UserAccount,
          as: 'creator',
          attributes: ['user_id', 'first_name', 'last_name', 'email'],
        },
        {
          model: ContentAudienceRule,
          as: 'audienceRules',
          where: { entity_type: 'PUSH' },
          required: false,
          include: [{
            model: OrgUnit,
            as: 'targetOrgUnit',
            attributes: ['org_unit_id', 'name', 'node_type', 'path'],
          }],
        },
      ],
    });

    if (!campaign) throw ApiError.notFound('Push campaign not found');
    return campaign;
  },

  async create(data, userId) {
    const { PushCampaign, ContentAudienceRule, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const campaign = await PushCampaign.create({
        tenant_id: DEFAULT_TENANT_ID,
        title: data.title,
        body: data.body,
        status: data.scheduled_at ? 'SCHEDULED' : 'DRAFT',
        created_by: userId,
        owning_org_unit_id: data.owning_org_unit_id,
        scheduled_at: data.scheduled_at || null,
      }, { transaction });

      // Create audience rules
      const rules = data.audience_org_unit_ids.map((ouId) => ({
        entity_type: 'PUSH',
        entity_id: campaign.push_campaign_id,
        target_org_unit_id: ouId,
      }));
      await ContentAudienceRule.bulkCreate(rules, { transaction });

      await auditService.log({
        user_id: userId,
        action: 'PUSH_CREATED',
        resource_type: 'PushCampaign',
        resource_id: campaign.push_campaign_id,
        details: { title: data.title },
      });

      await transaction.commit();
      return this.getById(campaign.push_campaign_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async send(id, userId) {
    const { PushCampaign } = require('../../database/models');

    const campaign = await PushCampaign.findByPk(id);
    if (!campaign) throw ApiError.notFound('Push campaign not found');
    if (campaign.status === 'SENT') throw ApiError.badRequest('Campaign already sent');
    if (campaign.status === 'CANCELLED') throw ApiError.badRequest('Campaign was cancelled');

    await campaign.update({
      status: 'SENT',
      sent_at: new Date(),
    });

    await auditService.log({
      user_id: userId,
      action: 'PUSH_SENT',
      resource_type: 'PushCampaign',
      resource_id: id,
    });

    return this.getById(id);
  },

  async cancel(id, userId) {
    const { PushCampaign } = require('../../database/models');

    const campaign = await PushCampaign.findByPk(id);
    if (!campaign) throw ApiError.notFound('Push campaign not found');
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw ApiError.badRequest('Only draft or scheduled campaigns can be cancelled');
    }

    await campaign.update({
      status: 'CANCELLED',
      cancelled_at: new Date(),
    });

    await auditService.log({
      user_id: userId,
      action: 'PUSH_CANCELLED',
      resource_type: 'PushCampaign',
      resource_id: id,
    });

    return this.getById(id);
  },
};

module.exports = pushService;
