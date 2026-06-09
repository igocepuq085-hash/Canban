# Деплой в Yandex Cloud через GitHub

Приложение разворачивается на одной виртуальной машине Yandex Compute Cloud.
GitHub Actions проверяет проект, собирает Docker-образ, публикует его в GitHub
Container Registry и обновляет контейнер на виртуальной машине.

SQLite хранится в постоянном Docker volume `taskflow-data` и не пропадает при
обновлении приложения. Для нескольких серверов потребуется переход на
Managed PostgreSQL.

## 1. Подготовьте виртуальную машину

Создайте Ubuntu VM с публичным IP и добавьте свой SSH-ключ. Для первого запуска
достаточно 2 vCPU, 2 GB RAM и диска 20 GB.

В группе безопасности разрешите:

- TCP 22 только со своего IP и адресов GitHub Actions либо временно из интернета;
- TCP 80 и TCP/UDP 443 из интернета.

Установите Docker и Compose:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

После добавления пользователя в группу Docker переподключитесь по SSH.

## 2. Настройте домен

Создайте A-запись домена, указывающую на публичный IP виртуальной машины.
Caddy автоматически получит и будет обновлять HTTPS-сертификат.

## 3. Добавьте секреты GitHub

В репозитории откройте `Settings` → `Environments` → `production` и добавьте:

| Секрет | Значение |
|---|---|
| `APP_SITE` | Домен без схемы, например `tasks.example.ru`, или временно `http://<IP>` |
| `SESSION_SECRET` | Случайная строка, результат `openssl rand -hex 32` |
| `YC_VM_HOST` | Публичный IP виртуальной машины |
| `YC_VM_USER` | SSH-пользователь, обычно `yc-user` |
| `YC_SSH_PRIVATE_KEY` | Приватный SSH-ключ для подключения к VM |
| `YC_SSH_KNOWN_HOSTS` | Результат `ssh-keyscan -H <IP-адрес-VM>` |

Защитите environment `production` подтверждением ответственного, если деплой
должен запускаться только после ручного одобрения.

## 4. Запустите первый деплой

Загрузите проект в GitHub и отправьте изменения в ветку `main`. Workflow
`Deploy to Yandex Cloud` запустится автоматически. Его также можно запустить
вручную на вкладке `Actions`.

После выпуска проверка доступна по адресу:

```text
https://<домен>/api/health
```

Успешный ответ: `{"status":"ok"}`.

## Резервное копирование

Перед важными обновлениями сохраняйте базу с VM:

```bash
docker run --rm -v taskflow_taskflow-data:/data -v "$PWD":/backup \
  alpine cp /data/taskflow.db /backup/taskflow-$(date +%F-%H%M).db
```

Для регулярных резервных копий настройте снимки диска VM или отдельную задачу
копирования базы в Yandex Object Storage.
