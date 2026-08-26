<?php
$targetFolder = __DIR__ . '/../laravel_backend/storage/app/public';
$linkFolder = __DIR__ . '/storage';
symlink($targetFolder, $linkFolder);
echo 'Symlink created successfully';
