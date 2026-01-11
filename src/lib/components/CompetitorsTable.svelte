<script lang="ts">
  interface Competitor {
    lastName: string;
    firstName: string;
    club: string;
    eolNumber: string;
  }

  interface Course {
    id: number;
    name: string;
    price: number;
  }

  interface Props {
    competitors: Competitor[];
    courses: Course[];
    onCourseSelect: (competitor: Competitor, courseId: number) => void;
  }

  let { competitors, courses, onCourseSelect }: Props = $props();
  let searchQuery = $state("");
  let selectedFilter = $state("all");
</script>

<main class="competitors-section">
  <!-- Search and filters -->
  <div class="search-section">
    <input 
      type="text" 
      class="search-input" 
      placeholder="Search by name or EOL number..."
      bind:value={searchQuery}
    />
    <div class="filters">
      <button class="filter-btn active" onclick={() => selectedFilter = 'all'}>All Competitors</button>
      <button class="filter-btn" onclick={() => selectedFilter = 'students'}>Students</button>
      <button class="filter-btn" onclick={() => selectedFilter = 'club1'}>Club Group 1</button>
    </div>
  </div>

  <!-- Competitors table -->
  <div class="table-wrapper">
    <table class="competitors-table">
      <thead>
        <tr>
          <th>Last Name</th>
          <th>First Name</th>
          <th>Club</th>
          <th>EOL #</th>
          <th>Course</th>
        </tr>
      </thead>
      <tbody>
        {#each competitors as competitor}
          <tr>
            <td class="bold">{competitor.lastName}</td>
            <td>{competitor.firstName}</td>
            <td>{competitor.club}</td>
            <td class="eol-number">{competitor.eolNumber}</td>
            <td class="course-select">
              <div class="course-buttons">
                {#each courses as course}
                  <button 
                    class="course-btn"
                    onclick={() => onCourseSelect(competitor, course.id)}
                  >
                    {course.id}
                  </button>
                {/each}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>

<style>
.competitors-section {
  background: #faf8f3;
  border-radius: 2px;
  padding: 1.5rem;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(139,119,89,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #d4c4a8;
}

.search-section {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.125rem;
  border: 1px solid #c9b896;
  border-radius: 2px;
  margin-bottom: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #f5f1e8;
  font-family: 'Georgia', serif;
  color: #3a2a1a;
}

.search-input:focus {
  outline: none;
  border-color: #8b7759;
  box-shadow: 0 0 0 2px rgba(139,119,89,0.1);
  background: #fff;
}

.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.75rem 1.5rem;
  background: #f5f1e8;
  border: 1px solid #c9b896;
  border-radius: 2px;
  font-size: 1rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 48px;
  font-family: 'Georgia', serif;
  color: #4a3a2a;
}

.filter-btn.active {
  background: #8b7759;
  color: #faf8f3;
  border-color: #6a5739;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
}

.filter-btn:hover:not(.active) {
  background: #e8dcc4;
  border-color: #a89676;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #c9b896;
  border-radius: 2px;
  background: #fff;
}

.competitors-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 1.125rem;
}

.competitors-table thead {
  background: #f5f1e8;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid #c9b896;
}

.competitors-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 500;
  border-bottom: 1px solid #d4c4a8;
  color: #3a2a1a;
  font-family: 'Georgia', serif;
  letter-spacing: 0.3px;
}

.competitors-table tbody tr {
  border-bottom: 1px solid #e8dcc4;
  transition: background-color 0.15s ease;
}

.competitors-table tbody tr:hover {
  background-color: #f9f6f0;
}

.competitors-table td {
  padding: 1rem;
  font-family: 'Georgia', serif;
  color: #2a1a0a;
}

.competitors-table td.bold {
  font-weight: 500;
}

.competitors-table td.eol-number {
  color: #6a5a4a;
  font-family: 'Courier New', monospace;
}

.course-select {
  padding: 0.5rem 1rem !important;
}

.course-buttons {
  display: flex;
  gap: 0.5rem;
}

.course-btn {
  background: #7a9b76;
  color: #faf8f3;
  border: 1px solid #5a7b56;
  border-radius: 2px;
  padding: 0.75rem 1rem;
  font-size: 1.125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 50px;
  min-height: 48px;
  font-family: 'Georgia', serif;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.course-btn:hover {
  background: #6a8b66;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.course-btn:active {
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
}
</style>
