import { v4 as uuidv4 } from 'uuid';
import models from '../models/postgres/index.js';
import { emitToSchool, emitToMasterAdmins, emitToUser } from '../sockets/index.js';

const { SupportTicket, User, Institute } = models;

export const supportService = {
  // ─────────────────────────────────────────────────────────────
  // INSTITUTE METHODS
  // ─────────────────────────────────────────────────────────────

  async createTicket(data, instituteId, userId) {
    const ticket = await SupportTicket.create({
      institute_id: instituteId,
      user_id: userId,
      subject: data.subject,
      description: data.description,
      category: data.category || 'GENERAL',
      priority: data.priority || 'LOW',
      status: 'OPEN',
      messages: [],
    });

    emitToMasterAdmins('support_ticket_update', { type: 'new_ticket', ticketId: ticket.id });

    return ticket;
  },

  async getInstituteTickets(instituteId) {
    return SupportTicket.findAll({
      where: { institute_id: instituteId },
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
  },

  async getTicketDetails(ticketId, instituteId = null) {
    const whereClause = { id: ticketId };
    if (instituteId) {
      whereClause.institute_id = instituteId;
    }

    const ticket = await SupportTicket.findOne({
      where: whereClause,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: Institute, as: 'Institute', attributes: ['id', 'institute_name', 'institute_code', 'institute_logo_url', 'institute_email', 'institute_contact'] }
      ]
    });

    if (!ticket) throw new Error('Support ticket not found');
    return ticket;
  },

  async addReply(ticketId, messageText, senderId, senderName, senderType, instituteId = null) {
    const ticket = await this.getTicketDetails(ticketId, instituteId);

    const newMessage = {
      id: uuidv4(),
      sender_id: senderId,
      sender_name: senderName,
      sender_type: senderType, // 'INSTITUTE' | 'MASTER_ADMIN'
      message: messageText,
      created_at: new Date().toISOString(),
    };

    const currentMessages = Array.isArray(ticket.messages) ? ticket.messages : [];
    ticket.messages = [...currentMessages, newMessage];
    
    // Automatically reopen ticket if institute replies to a closed/resolved ticket
    if (senderType === 'INSTITUTE' && ['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      ticket.status = 'OPEN';
    }

    await ticket.save();

    // Emit real-time socket events
    console.log(`[Socket Debug] Emitting reply to school:${ticket.institute_id} and user:${ticket.user_id} from ${senderType}`);
    if (senderType === 'MASTER_ADMIN') {
      emitToSchool(ticket.institute_id, 'support_ticket_update', { type: 'new_reply', ticketId });
      emitToUser(ticket.user_id, 'support_ticket_update', { type: 'new_reply', ticketId });
      emitToMasterAdmins('support_ticket_update', { type: 'new_reply', ticketId, is_self: true });
    } else {
      emitToMasterAdmins('support_ticket_update', { type: 'new_reply', ticketId });
      emitToSchool(ticket.institute_id, 'support_ticket_update', { type: 'new_reply', ticketId, is_self: true });
    }

    return ticket;
  },

  // ─────────────────────────────────────────────────────────────
  // MASTER ADMIN METHODS
  // ─────────────────────────────────────────────────────────────

  async getAllTickets(filters = {}) {
    const whereClause = {};

    if (filters.status) whereClause.status = filters.status;
    if (filters.priority) whereClause.priority = filters.priority;
    if (filters.institute_id) whereClause.institute_id = filters.institute_id;

    return SupportTicket.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        { model: Institute, as: 'Institute', attributes: ['id', 'institute_name', 'institute_code', 'institute_logo_url'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });
  },

  async updateTicketStatus(ticketId, status) {
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) throw new Error('Support ticket not found');

    ticket.status = status;
    await ticket.save();

    // Notify everyone so all agents see the status change
    emitToSchool(ticket.institute_id, 'support_ticket_update', { type: 'status_changed', ticketId, status });
    emitToUser(ticket.user_id, 'support_ticket_update', { type: 'status_changed', ticketId, status });
    emitToMasterAdmins('support_ticket_update', { type: 'status_changed', ticketId, status, is_self: true });

    return ticket;
  }
};
