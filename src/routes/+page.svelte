<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import AlphabetNav from '$lib/components/AlphabetNav.svelte';
  import CompetitorsTable from '$lib/components/CompetitorsTable.svelte';
  import SummaryPanel from '$lib/components/SummaryPanel.svelte';

  interface RegistrationData {
    id?: number;
    competitor_first_name: string;
    competitor_last_name: string;
    club: string;
    eol_number: string;
    course_id: number;
    course_name: string;
    price: number;
    timestamp: string;
  }

  // Sample data for regular competitors
  let regularCompetitors = $state([
    { lastName: "Anderson", firstName: "John", club: "OK Võru", eolNumber: "12345" },
    { lastName: "Bergman", firstName: "Anna", club: "SK Hiiu", eolNumber: "12346" },
    { lastName: "Berg", firstName: "Marta", club: "OK Tartu", eolNumber: "12347" },
    { lastName: "Chen", firstName: "Li", club: "SK Tallinn", eolNumber: "12348" },
    { lastName: "Davis", firstName: "Sarah", club: "OK Võru", eolNumber: "12349" },
    { lastName: "Evans", firstName: "Michael", club: "SK Pärnu", eolNumber: "12350" },
    { lastName: "Fischer", firstName: "Emma", club: "OK Tartu", eolNumber: "12351" },
    { lastName: "Garcia", firstName: "Carlos", club: "SK Hiiu", eolNumber: "12352" },
    { lastName: "Hansen", firstName: "Erik", club: "OK Võru", eolNumber: "12353" },
    { lastName: "Ivanov", firstName: "Dmitri", club: "SK Tallinn", eolNumber: "12354" },
    { lastName: "Johnson", firstName: "Emily", club: "OK Tartu", eolNumber: "12355" },
    { lastName: "Kumar", firstName: "Raj", club: "SK Pärnu", eolNumber: "12356" },
    { lastName: "Lee", firstName: "Min", club: "OK Võru", eolNumber: "12357" },
    { lastName: "Martinez", firstName: "Sofia", club: "SK Hiiu", eolNumber: "12358" },
    { lastName: "Nielsen", firstName: "Lars", club: "OK Tartu", eolNumber: "12359" },
  ]);

  // Course options
  let courses = [
    { id: 1, name: "Course 1", price: 5 },
    { id: 2, name: "Course 2", price: 7 },
    { id: 3, name: "Course 3", price: 10 },
    { id: 4, name: "Course 4", price: 12 },
  ];

  // Recent registrations
  let recentRegistrations = $state<Array<{ name: string, course: string, price: number }>>([]);

  // Load recent registrations on mount
  async function loadRecentRegistrations() {
    try {
      const registrations = await invoke<RegistrationData[]>('get_recent_registrations', { limit: 10 });
      recentRegistrations = registrations.map(r => ({
        name: `${r.competitor_first_name} ${r.competitor_last_name}`,
        course: r.course_name,
        price: r.price
      }));
    } catch (error) {
      console.error('Failed to load registrations:', error);
    }
  }

  // Call on component mount
  $effect(() => {
    loadRecentRegistrations();
  });

  async function handleCourseSelect(competitor: any, courseId: number) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      const registration: RegistrationData = {
        competitor_first_name: competitor.firstName,
        competitor_last_name: competitor.lastName,
        club: competitor.club,
        eol_number: competitor.eolNumber,
        course_id: course.id,
        course_name: course.name,
        price: course.price,
        timestamp: new Date().toISOString(),
      };

      try {
        // Save to database
        await invoke('save_registration', { registration });
        
        // Update UI
        recentRegistrations = [
          { name: `${competitor.firstName} ${competitor.lastName}`, course: course.name, price: course.price },
          ...recentRegistrations
        ].slice(0, 10);
      } catch (error) {
        console.error('Failed to save registration:', error);
      }
    }
  }
</script>

<div class="app-container">
  <div class="main-row">
    <AlphabetNav />
    <CompetitorsTable 
      competitors={regularCompetitors} 
      courses={courses}
      onCourseSelect={handleCourseSelect}
    />
  </div>
  <SummaryPanel registrations={recentRegistrations} />
</div>

<style>
:global(body) {
  margin: 0;
  padding: 0;
  font-family: 'Georgia', 'Times New Roman', serif;
  background-color: #e8dcc4;
  overflow: hidden;
}

.app-container {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 1rem;
  padding: 1rem;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.main-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 1rem;
  overflow: hidden;
}

/* Scrollbar styling */
:global(::-webkit-scrollbar) {
  width: 10px;
  height: 10px;
}

:global(::-webkit-scrollbar-track) {
  background: #f5f1e8;
  border-radius: 2px;
}

:global(::-webkit-scrollbar-thumb) {
  background: #b8a989;
  border-radius: 2px;
}

:global(::-webkit-scrollbar-thumb:hover) {
  background: #9a8a6f;
}
</style>
