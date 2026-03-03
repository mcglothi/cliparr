# Deploying Cliparr on TrueNAS

This repo includes playbooks to integrate Cliparr with your existing stack:

- Dockge stack deployment on TrueNAS
- Pi-hole local DNS
- Nginx Proxy Manager HTTPS proxy host
- Wildcard certificate attachment

## Prereqs

- Existing inventory with `truenas` host
- NPM API reachable
- Wildcard cert already created in NPM

## Run sequence

```bash
ansible-playbook -i ops/ansible/inventory.ini ops/ansible/deploy_cliparr_stack.yml
ansible-playbook -i ops/ansible/inventory.ini ops/ansible/update_cliparr_dns.yml
ansible-playbook -i ops/ansible/inventory.ini ops/ansible/configure_cliparr_proxy.yml
```

## Result

`https://cliparr.home.timmcg.net` routes to Cliparr web service running in a Dockge-managed stack on TrueNAS.
