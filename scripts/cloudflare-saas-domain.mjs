export function resolveSaasDomainPlan({ manifest, platform, customHostnames = [], workerRoutes = [] }) {
  if (!manifest?.domain || manifest.domain.mode !== 'saas-custom-hostname') {
    throw new Error('SaaS domain planning requires a saas-custom-hostname installation.');
  }
  if (!platform?.customerCnameTarget) throw new Error('SaaS platform customer CNAME target is required.');

  const hostname = manifest.publicDomain;
  const routePattern = `${hostname}/*`;
  const matchingHosts = customHostnames.filter((entry) => entry?.hostname === hostname);
  if (matchingHosts.length > 1) throw new Error(`Multiple Custom Hostname records exist for ${hostname}; refusing to guess ownership.`);

  const matchingRoutes = workerRoutes.filter((entry) => entry?.pattern === routePattern);
  if (matchingRoutes.length > 1) throw new Error(`Multiple Worker routes exist for ${routePattern}; refusing to guess ownership.`);
  if (matchingRoutes[0] && matchingRoutes[0].script !== manifest.appWorker) {
    throw new Error(`Worker route ${routePattern} belongs to another Worker (${matchingRoutes[0].script}); expected ${manifest.appWorker}.`);
  }

  return {
    hostname,
    appWorker: manifest.appWorker,
    routePattern,
    createCustomHostname: matchingHosts.length === 0,
    customHostnameId: matchingHosts[0]?.id ?? null,
    customHostnameStatus: matchingHosts[0]?.status ?? null,
    createWorkerRoute: matchingRoutes.length === 0,
    workerRouteId: matchingRoutes[0]?.id ?? null,
    cnameInstruction: `CNAME ${hostname} -> ${platform.customerCnameTarget}`,
  };
}
