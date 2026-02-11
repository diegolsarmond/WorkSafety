#!/bin/sh
set -e
python manage.py migrate --noinput
if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "true" ] || [ "$DEBUG" = "1" ]; then
    echo "Running in DEVELOPMENT mode (Django runserver)"
    exec python manage.py runserver 0.0.0.0:8000
else
    echo "Running in PRODUCTION mode (Gunicorn)"
    # 4 workers é um bom default para container pequeno. Ajustar conforme CPU.
    exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --threads 4
fi
