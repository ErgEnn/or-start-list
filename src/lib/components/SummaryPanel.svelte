<script lang="ts">
  interface Registration {
    name: string;
    course: string;
    price: number;
  }

  interface Props {
    registrations: Registration[];
  }

  let { registrations }: Props = $props();
  let isExpanded = $state(false);

  let last2Total = $derived(registrations.slice(0, 2).reduce((sum, r) => sum + r.price, 0));
  let last3Total = $derived(registrations.slice(0, 3).reduce((sum, r) => sum + r.price, 0));
  let last4Total = $derived(registrations.slice(0, 4).reduce((sum, r) => sum + r.price, 0));

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
</script>

<aside class="summary-panel" class:expanded={isExpanded}>
  <button class="panel-header" onclick={toggleExpanded}>
    <div class="panel-title">Recent Registrations</div>
    <div class="toggle-icon">{isExpanded ? '▼' : '▲'}</div>
  </button>
  
  {#if isExpanded}
    <div class="panel-content">
      <div class="registrations-list">
        {#if registrations.length === 0}
          <div class="empty-state">No registrations yet</div>
        {:else}
          {#each registrations.slice(0, 3) as registration}
            <div class="registration-item">
              <div class="reg-name">{registration.name}</div>
              <div class="reg-details">
                <span class="reg-course">{registration.course}</span>
                <span class="reg-price">€{registration.price}</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      {#if registrations.length > 0}
        <div class="totals-section">
          <div class="total-item">
            <span class="total-label">Last 2:</span>
            <span class="total-value">€{last2Total}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Last 3:</span>
            <span class="total-value">€{last3Total}</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
.summary-panel {
  background: #faf8f3;
  border-radius: 2px;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(139,119,89,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #d4c4a8;
  max-height: 220px;
  transition: max-height 0.3s ease;
}

.summary-panel.expanded {
  max-height: 400px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.15s ease;
}

.panel-header:hover {
  background-color: #f5f1e8;
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 500;
  color: #3a2a1a;
  font-family: 'Georgia', serif;
  letter-spacing: 0.5px;
  margin: 0;
}

.toggle-icon {
  font-size: 1rem;
  color: #5a4a3a;
  user-select: none;
}

.panel-content {
  padding: 0 1.5rem 1.5rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  overflow: hidden;
}

.registrations-list {
  overflow-y: auto;
  max-height: 280px;
}

.empty-state {
  text-align: center;
  color: #8a7a6a;
  padding: 2rem;
  font-style: italic;
  font-family: 'Georgia', serif;
}

.registration-item {
  background: #f5f1e8;
  border-left: 3px solid #8b7759;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-radius: 1px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border-right: 1px solid #e8dcc4;
  border-top: 1px solid #e8dcc4;
  border-bottom: 1px solid #e8dcc4;
}

.reg-name {
  font-weight: 500;
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
  color: #2a1a0a;
  font-family: 'Georgia', serif;
}

.reg-details {
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
  font-family: 'Georgia', serif;
}

.reg-course {
  color: #5a4a3a;
}

.reg-price {
  font-weight: 500;
  color: #5a7856;
  font-size: 1.125rem;
}

.totals-section {
  border-left: 1px solid #c9b896;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-width: 200px;
}

.total-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #f5f1e8;
  border-radius: 1px;
  font-size: 1.125rem;
  border: 1px solid #e8dcc4;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  white-space: nowrap;
}

.total-label {
  font-weight: 400;
  color: #5a4a3a;
  font-family: 'Georgia', serif;
}

.total-value {
  font-weight: 500;
  color: #4a3a2a;
  font-size: 1.25rem;
  font-family: 'Georgia', serif;
}
</style>
