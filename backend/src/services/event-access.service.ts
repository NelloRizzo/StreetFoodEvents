import { RoleModel } from '@/models/role.model';
import { StandModel } from '@/models/stand.model';
import { UserRoleModel } from '@/models/user-role.model';

export type EventAccess = {
    /** true se l'utente ha almeno un ruolo di scope platform (es. platform-admin). */
    isPlatform: boolean;
    /** eventId dei ruoli di scope event. */
    fromEventRoles: string[];
    /** eventId derivati dagli stand su cui l'utente ha un ruolo. */
    fromStandRoles: string[];
    /** true se l'utente ha almeno un ruolo di scope event. */
    hasEventRole: boolean;
};

/**
 * Quali eventi "vede" un utente nel pannello di gestione.
 *
 * Un event-admin (o qualunque ruolo di scope event) vede SOLO gli eventi su cui
 * ha ruoli: chi non ha ruoli su un evento non deve vederselo elencato da
 * nessuna parte. I ruoli di scope platform vedono invece tutto.
 */
export async function getEventAccess(userId: string): Promise<EventAccess> {
    const platformRoleIds = await RoleModel.find({ scope: 'platform' }).distinct('_id');
    const isPlatform = platformRoleIds.length > 0
        ? !!(await UserRoleModel.findOne({ userId, roleId: { $in: platformRoleIds }, isActive: true }))
        : false;

    const eventRoleIds = await RoleModel.find({ scope: 'event' }).distinct('_id');
    const userEventRoles = eventRoleIds.length > 0
        ? await UserRoleModel.find({ userId, roleId: { $in: eventRoleIds }, eventId: { $ne: null }, isActive: true })
        : [];
    const fromEventRoles = [...new Set(userEventRoles.map((ur) => ur.eventId!.toString()))];

    const standRoleIds = await RoleModel.find({ scope: 'stand' }).distinct('_id');
    const userStandRoles = standRoleIds.length > 0
        ? await UserRoleModel.find({ userId, roleId: { $in: standRoleIds }, standId: { $ne: null }, isActive: true })
        : [];
    const standIds = [...new Set(userStandRoles.map((ur) => ur.standId!.toString()))];

    let fromStandRoles: string[] = [];
    if (standIds.length > 0) {
        const stands = await StandModel.find({ _id: { $in: standIds } }).select('eventIds');
        fromStandRoles = [...new Set(stands.flatMap((s) => (s.eventIds ?? []).map((id) => id.toString())))];
    }

    return {
        isPlatform,
        fromEventRoles,
        fromStandRoles,
        hasEventRole: userEventRoles.length > 0
    };
}

/** Tutti gli eventId visibili all'utente (unione ruoli evento + ruoli stand). */
export async function getAccessibleEventIds(userId: string): Promise<string[]> {
    const access = await getEventAccess(userId);
    if (access.isPlatform) return [];
    return [...new Set([...access.fromEventRoles, ...access.fromStandRoles])];
}
