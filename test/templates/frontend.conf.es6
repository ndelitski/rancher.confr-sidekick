export default async function () {
  const proxy_set_header = `proxy_set_header        Host            \$host;
        proxy_set_header        X-Real-IP       \$remote_addr;
        proxy_set_header        X-Forwarded-For \$proxy_add_x_forwarded_for;
`;
  return {
    '/tmp/synccloud.frontend/config.json': {
      content: await key('files/config.json'),
      reload: true
    },
    '/tmp/nginx/conf.d/nginx.conf': {
      content: await aw`
upstream app {
  server localhost:${key('port')};
}

server {
    listen 80;

    client_max_body_size 100M;

    location ~ ^/api {
        proxy_pass ${key('backend')};
        ${proxy_set_header}
    }

    location ~ ^/echo {
        proxy_pass ${key('backend')};
        ${proxy_set_header}
    }

    location ~ ^/task/filedownload {
        proxy_pass ${key('backend')};
        ${proxy_set_header}
    }

    location / {
        proxy_pass http://app;

    }
}`
    }
  }
}
