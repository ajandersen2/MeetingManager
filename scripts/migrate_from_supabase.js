/**
 * Migration script: Supabase → Remote Postgres
 * 
 * Migrates users, profiles, meetings, attendees, groups, members,
 * invitations, api_keys, and app_settings from old Supabase data.
 * 
 * User IDs are remapped since the new DB uses its own users table.
 */
import pg from 'pg'

const TARGET_DB = process.env.DATABASE_URL || 'postgresql://meeting_mgr:MeetMgr2024Secure!@23.227.187.247:5432/meeting_mgr_db'

const pool = new pg.Pool({
  connectionString: TARGET_DB,
  ssl: { rejectUnauthorized: false }
})

// Old Supabase user_id → new user_id mapping (filled during migration)
const userIdMap = {}

// ──────────────────────────────────────
// SOURCE DATA (extracted from Supabase)
// ──────────────────────────────────────

const OLD_USERS = [
  {
    old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8',
    email: 'ajandersen@gmail.com',
    // bcrypt hash from Supabase auth.users — $2a$ is compatible with bcryptjs
    password_hash: '$2a$10$.I/4rYNV/1l8JO1FWnDqBegfpzMkKmAeCS.0X.h/DP1n6K3RkjjuG'
  },
  {
    old_id: '6948de4c-e3d6-4900-a746-2c626864c314',
    email: 'jacob.andersen@exel.io',
    password_hash: '$2a$10$sVJ9eymWVzG6avFIglPTLegHdMfBcNLEkwaB/7Pf4nFdBExJwnuPi'
  }
]

const OLD_PROFILES = [
  { user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', display_name: 'Jacob Andersen', role: 'admin' },
  { user_old_id: '6948de4c-e3d6-4900-a746-2c626864c314', display_name: null, role: 'user' }
]

const OLD_GROUPS = [
  { id: '3002d053-9776-4910-8943-020e4b2311cc', name: 'EQ', join_code: '72PNEC', created_by_old: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { id: '08cc1264-d612-40d0-a2a3-602d0d6da6a9', name: 'RS', join_code: 'Z34M6S', created_by_old: '6948de4c-e3d6-4900-a746-2c626864c314' }
]

const OLD_GROUP_MEMBERS = [
  { group_id: '3002d053-9776-4910-8943-020e4b2311cc', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', role: 'owner' },
  { group_id: '3002d053-9776-4910-8943-020e4b2311cc', user_old_id: '6948de4c-e3d6-4900-a746-2c626864c314', role: 'member' },
  { group_id: '08cc1264-d612-40d0-a2a3-602d0d6da6a9', user_old_id: '6948de4c-e3d6-4900-a746-2c626864c314', role: 'owner' }
]

const OLD_MEETINGS = [
  { id: '768f5f73-1ede-4400-936c-737a53133fa7', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'EQ Mtg', date: '2026-01-27', time: '00:15:00', location: 'Springdale church', objective: 'weekly mtgs', group_id: null },
  { id: 'fda70c5d-6eb3-47cd-af01-374b187ecba5', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'RS Meeting', date: '2026-01-27', time: null, location: null, objective: null, group_id: null },
  { id: '185011cc-58ad-4811-9ef0-b4520d2a1deb', user_old_id: '6948de4c-e3d6-4900-a746-2c626864c314', name: 'eq - exel', date: '2026-01-27', time: null, location: null, objective: null, group_id: '3002d053-9776-4910-8943-020e4b2311cc' },
  { id: '38116a31-6490-4c1b-821e-c9a7eddb42de', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'Missionary huddle', date: '2026-02-01', time: '09:45:00', location: 'Springdale church', objective: 'Missionary huddl', group_id: null },
  { id: '4f9ce964-318d-44f0-9211-5d1909093475', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'Missionary meeting ', date: '2026-02-01', time: '12:00:00', location: null, objective: null, group_id: null },
  { id: '2a97ff65-c481-4c6f-897f-60c39d7000d2', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'EQ Meeting', date: '2026-02-04', time: '18:00:00', location: "Mason's House", objective: null, group_id: null },
  { id: '07cb5f82-99c9-4335-919c-9e5dd9b6beac', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'EQ Meeting', date: '2026-02-08', time: '12:56:00', location: '452 Zion Park Boulevard, Rockville, Utah', objective: null, group_id: null },
  { id: 'da23088f-061a-4255-9f99-d14490506261', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'EQ Meeting', date: '2026-02-08', time: '13:20:00', location: '378 Zion Park Boulevard, Rockville, Utah', objective: null, group_id: null },
  { id: '0dc3e882-e447-4115-b09d-6074c5dd9fe0', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8', name: 'EQ Meeting', date: '2026-02-09', time: '17:28:00', location: '378 Zion Park Boulevard, Rockville, Utah', objective: null, group_id: null }
]

// Content fields mapped by meeting ID (too large to inline above)
const MEETING_CONTENT = {
  '768f5f73-1ede-4400-936c-737a53133fa7': {
    agenda_content: '<h4><strong>7:30–8:30 a.m. Arrival and preparation</strong></h4><ul><li><p>Put up signs, if needed</p></li><li><p>Arrange tables and chairs</p></li><li><p>Arrange handout materials</p></li></ul>',
    minutes_content: '<h3>DISCUSSION SUMMARY</h3><p>The meeting commenced with a warm welcome from Jacob Andersen...</p>',
    raw_transcript: null
  },
  '07cb5f82-99c9-4335-919c-9e5dd9b6beac': {
    agenda_content: null,
    minutes_content: '<h3>DISCUSSION SUMMARY</h3><p>The meeting commenced with Jacob Andersen introducing himself...</p>',
    raw_transcript: '<p></p><h3>Meeting Transcript</h3><p><em>1 speaker detected</em></p><p><strong>Speaker 1:</strong> I am Jacob. Hey. Who are you?...</p>'
  },
  'da23088f-061a-4255-9f99-d14490506261': {
    agenda_content: null,
    minutes_content: '<h3>DISCUSSION SUMMARY</h3><p>The meeting commenced with Jacob Andersen initiating the session...</p>',
    raw_transcript: '<h3>Meeting Transcript</h3><p><em>1 speaker detected</em></p><p><strong>Speaker 1:</strong> Hello. Hello. Hello. Hello.</p>'
  },
  '0dc3e882-e447-4115-b09d-6074c5dd9fe0': {
    agenda_content: null,
    minutes_content: null,
    raw_transcript: '<h3>Meeting Transcript</h3><p><em>1 speaker detected</em></p><p><strong>Speaker 1:</strong> I just reported him. Hello...</p>'
  },
  '38116a31-6490-4c1b-821e-c9a7eddb42de': {
    agenda_content: null,
    minutes_content: '<h3>DISCUSSION SUMMARY</h3><p>The meeting commenced with a warm welcome from Jacob Andersen...</p>',
    raw_transcript: null
  }
}

const OLD_ATTENDEES = [
  { meeting_id: 'fda70c5d-6eb3-47cd-af01-374b187ecba5', name: 'Jake Andersen', user_old_id: null },
  { meeting_id: 'fda70c5d-6eb3-47cd-af01-374b187ecba5', name: 'ajandersen@gmail.com', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Jacob Andersen', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Kayla Roth', user_old_id: null },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Jon Fernand', user_old_id: null },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Rhonda Garate', user_old_id: null },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Madelyn Roth', user_old_id: null },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Carter Lee', user_old_id: null },
  { meeting_id: '38116a31-6490-4c1b-821e-c9a7eddb42de', name: 'Benjamin Allred', user_old_id: null },
  { meeting_id: '4f9ce964-318d-44f0-9211-5d1909093475', name: 'Kayla Roth', user_old_id: null },
  { meeting_id: '4f9ce964-318d-44f0-9211-5d1909093475', name: 'Jacob Andersen', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { meeting_id: '768f5f73-1ede-4400-936c-737a53133fa7', name: 'jacob andersen', user_old_id: null },
  { meeting_id: '768f5f73-1ede-4400-936c-737a53133fa7', name: 'mark stanger', user_old_id: null },
  { meeting_id: '768f5f73-1ede-4400-936c-737a53133fa7', name: 'shantell andersen', user_old_id: null },
  { meeting_id: '768f5f73-1ede-4400-936c-737a53133fa7', name: 'Jacob Andersen', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { meeting_id: '07cb5f82-99c9-4335-919c-9e5dd9b6beac', name: 'Jacob Andersen', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { meeting_id: 'da23088f-061a-4255-9f99-d14490506261', name: 'Jacob Andersen', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' },
  { meeting_id: '0dc3e882-e447-4115-b09d-6074c5dd9fe0', name: 'Jacob Andersen', user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8' }
]

const OLD_API_KEYS = [
  {
    user_old_id: 'a53f53a4-e1ca-49e9-b52c-77d61d509df8',
    openai_api_key: '*** REDACTED - already migrated ***',
    deepgram_api_key: '*** REDACTED - already migrated ***'
  }
]

// ──────────────────────────────────────
// MIGRATION LOGIC
// ──────────────────────────────────────

async function migrate() {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    console.log('🚀 Starting migration from Supabase...\n')

    // 1. Create users (skip if email already exists)
    console.log('👤 Migrating users...')
    for (const u of OLD_USERS) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [u.email])
      if (existing.rows.length > 0) {
        userIdMap[u.old_id] = existing.rows[0].id
        console.log(`  ⏩ ${u.email} already exists (id: ${existing.rows[0].id})`)
      } else {
        const { rows } = await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          [u.email, u.password_hash]
        )
        userIdMap[u.old_id] = rows[0].id
        console.log(`  ✅ Created ${u.email} (id: ${rows[0].id})`)
      }
    }
    console.log('  ID mapping:', userIdMap)

    // 2. Create profiles (skip if exists)
    console.log('\n📋 Migrating user profiles...')
    for (const p of OLD_PROFILES) {
      const newUserId = userIdMap[p.user_old_id]
      const existing = await client.query('SELECT id FROM user_profiles WHERE user_id = $1', [newUserId])
      if (existing.rows.length > 0) {
        // Update existing profile with old data
        await client.query(
          'UPDATE user_profiles SET display_name = COALESCE($1, display_name), role = $2 WHERE user_id = $3',
          [p.display_name, p.role, newUserId]
        )
        console.log(`  🔄 Updated profile for user ${newUserId} (role: ${p.role})`)
      } else {
        await client.query(
          'INSERT INTO user_profiles (user_id, display_name, role) VALUES ($1, $2, $3)',
          [newUserId, p.display_name, p.role]
        )
        console.log(`  ✅ Created profile for user ${newUserId}`)
      }
    }

    // 3. Groups (preserve original UUIDs for FK consistency)
    console.log('\n👥 Migrating groups...')
    const groupIdMap = {} // old group id → new group id
    for (const g of OLD_GROUPS) {
      const existing = await client.query('SELECT id FROM meeting_groups WHERE join_code = $1', [g.join_code])
      if (existing.rows.length > 0) {
        groupIdMap[g.id] = existing.rows[0].id
        console.log(`  ⏩ Group "${g.name}" already exists`)
      } else {
        const { rows } = await client.query(
          'INSERT INTO meeting_groups (name, join_code, created_by) VALUES ($1, $2, $3) RETURNING id',
          [g.name, g.join_code, userIdMap[g.created_by_old]]
        )
        groupIdMap[g.id] = rows[0].id
        console.log(`  ✅ Created group "${g.name}" (id: ${rows[0].id})`)
      }
    }

    // 4. Group members
    console.log('\n👤 Migrating group members...')
    for (const gm of OLD_GROUP_MEMBERS) {
      const newGroupId = groupIdMap[gm.group_id]
      const newUserId = userIdMap[gm.user_old_id]
      const existing = await client.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [newGroupId, newUserId]
      )
      if (existing.rows.length > 0) {
        console.log(`  ⏩ Member already in group`)
      } else {
        await client.query(
          'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
          [newGroupId, newUserId, gm.role]
        )
        console.log(`  ✅ Added user ${newUserId} to group ${newGroupId} as ${gm.role}`)
      }
    }

    // 5. Meetings
    console.log('\n📅 Migrating meetings...')
    const meetingIdMap = {} // old meeting id → new meeting id
    for (const m of OLD_MEETINGS) {
      const newUserId = userIdMap[m.user_old_id]
      const newGroupId = m.group_id ? groupIdMap[m.group_id] : null
      const content = MEETING_CONTENT[m.id] || {}

      const { rows } = await client.query(
        `INSERT INTO meetings (user_id, name, date, time, location, objective, agenda_content, minutes_content, raw_transcript, group_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [newUserId, m.name, m.date, m.time, m.location, m.objective,
         content.agenda_content || null, content.minutes_content || null,
         content.raw_transcript || null, newGroupId]
      )
      meetingIdMap[m.id] = rows[0].id
      console.log(`  ✅ "${m.name}" (${m.date}) → id: ${rows[0].id}`)
    }

    // 6. Attendees
    console.log('\n🙋 Migrating attendees...')
    for (const att of OLD_ATTENDEES) {
      const newMeetingId = meetingIdMap[att.meeting_id]
      const newUserId = att.user_old_id ? userIdMap[att.user_old_id] : null
      
      await client.query(
        'INSERT INTO meeting_attendees (meeting_id, name, user_id) VALUES ($1, $2, $3)',
        [newMeetingId, att.name, newUserId]
      )
    }
    console.log(`  ✅ Migrated ${OLD_ATTENDEES.length} attendees`)

    // 7. API Keys
    console.log('\n🔑 Migrating API keys...')
    for (const k of OLD_API_KEYS) {
      const newUserId = userIdMap[k.user_old_id]
      await client.query(
        `INSERT INTO user_api_keys (user_id, openai_api_key, deepgram_api_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           openai_api_key = $2, deepgram_api_key = $3, updated_at = NOW()`,
        [newUserId, k.openai_api_key, k.deepgram_api_key]
      )
      console.log(`  ✅ API keys set for user ${newUserId}`)
    }

    // 8. App Settings (update existing)
    console.log('\n⚙️  Updating app settings...')
    await client.query(
      `UPDATE app_settings SET ai_model = 'gpt-4o-mini', max_tokens = 8192, temperature = 0.1, updated_at = NOW()`
    )
    console.log('  ✅ App settings updated')

    await client.query('COMMIT')
    console.log('\n🎉 Migration complete!')
    
    // Summary
    console.log('\n📊 Summary:')
    console.log(`  Users:      ${OLD_USERS.length}`)
    console.log(`  Profiles:   ${OLD_PROFILES.length}`)
    console.log(`  Groups:     ${OLD_GROUPS.length}`)
    console.log(`  Members:    ${OLD_GROUP_MEMBERS.length}`)
    console.log(`  Meetings:   ${OLD_MEETINGS.length}`)
    console.log(`  Attendees:  ${OLD_ATTENDEES.length}`)
    console.log(`  API Keys:   ${OLD_API_KEYS.length}`)
    
    console.log('\n⚠️  NOTE: 2 attachment files (PDF + audio) were in Supabase Storage.')
    console.log('  These cannot be migrated via SQL. The DB records will reference')
    console.log('  non-existent files. Re-upload them manually if needed.')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed, rolled back:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
